const _ = require('lodash');
const uglifycss = require('uglifycss');
const colors = require('colors');
const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const glob = require('glob');
const async = require('async');
const nodemailer = require('nodemailer');
const sanitizeHtml = require('sanitize-html');
const escape = require('html-entities').AllHtmlEntities;
const mkdirp = require('mkdirp');
const ObjectId = require('mongodb').ObjectID;
const countryList = require('countries-list');

// Parse country list once
const countryArray = [];
Object.keys(countryList.countries).forEach((country) => {
    countryArray.push(countryList.countries[country].name);
});

// Allowed mime types for product images
const allowedMimeType = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/bmp',
    'image/webp'
];

const fileSizeLimit = 10485760;

// common functions
const cleanHtml = (html) => {
    return sanitizeHtml(html);
};

const mongoSanitize = (param) => {
    if(param instanceof Object){
        for(const key in param){
            if(/^\$/.test(key)){
                delete param[key];
            }
        }
    }
    return param;
};

const safeParseInt = (param) => {
    if(param){
        try{
            return parseInt(param);
        }catch(ex){
            return param;
        }
    }else{
        return param;
    }
};

const checkboxBool = (param) => {
    if(param && param === 'on'){
        return true;
    }
    if(param && param === 'true'){
        return true;
    }
    return false;
};

const convertBool = (value) => {
    if(value === 'true' || value === true){
        return true;
    }
    return false;
};

// adds products to sitemap.xml
const addSitemapProducts = (req, res, cb) => {
    const db = req.app.db;

    const config = getConfig();
    const hostname = config.baseUrl;

    db.products.find({ productPublished: true }).toArray((err, products) => {
        const posts = [];
        if(err){
            cb(null, posts);
        }
        async.eachSeries(products, (item, callback) => {
            const post = {};
            let url = item._id;
            if(item.productPermalink){
                url = item.productPermalink;
            }
            post.url = hostname + '/' + url;
            post.changefreq = 'weekly';
            post.priority = 0.7;
            posts.push(post);
            callback(null, posts);
        }, () => {
            cb(null, posts);
        });
    });
};

const clearSessionValue = (session, sessionVar) => {
    let temp;
    if(session){
        temp = session[sessionVar];
        session[sessionVar] = null;
    }
    return temp;
};

const updateTotalCart = async (req, res) => {
    const config = getConfig();
    const db = req.app.db;

    req.session.totalCartAmount = 0;
    req.session.totalCartItems = 0;
    req.session.totalCartProducts = 0;

    // If cart is empty return zero values
    if(!req.session.cart){
        return;
    }

    Object.keys(req.session.cart).forEach((item) => {
        req.session.totalCartAmount = req.session.totalCartAmount + req.session.cart[item].totalItemPrice;
        req.session.totalCartProducts = req.session.totalCartProducts + req.session.cart[item].quantity;
    });

    // Update the total items in cart for the badge
    req.session.totalCartItems = Object.keys(req.session.cart).length;

    // Update the total amount not including shipping/discounts
    req.session.totalCartNetAmount = req.session.totalCartAmount;

    // Calculate shipping using the loaded module
    config.modules.loaded.shipping.calculateShipping(
        req.session.totalCartNetAmount,
        config,
        req
    );

    // If discount module enabled
    if(config.modules.loaded.discount){
        // Recalculate discounts
        const discount = await db.discounts.findOne({ code: req.session.discountCode });
        if(discount){
            config.modules.loaded.discount.calculateDiscount(
                discount,
                req
            );
        }else{
            // If discount code is not found, remove it
            delete req.session.discountCode;
            req.session.totalCartDiscount = 0;
        }
    }

    // Calculate our total amount removing discount and adding shipping
    req.session.totalCartAmount = (req.session.totalCartNetAmount - req.session.totalCartDiscount) + req.session.totalCartShipping;
};

const emptyCart = async (req, res, type, customMessage) => {
    const db = req.app.db;

    // Remove from session
    delete req.session.cart;
    delete req.session.shippingAmount;
    delete req.session.orderId;
    delete req.session.cartSubscription;
    delete req.session.discountCode;

    // Remove cart from DB
    await db.cart.deleteOne({ sessionId: req.session.id });

    // update total cart
    await updateTotalCart(req, res);

    // Update checking cart for subscription
    updateSubscriptionCheck(req, res);

    // Set returned message
    let message = 'Cart successfully emptied';
    if(customMessage){
        message = customMessage;
    }

    if(type === 'function'){
        return;
    }

    // If POST, return JSON else redirect nome
    if(type === 'json'){
        res.status(200).json({ message: message, totalCartItems: 0 });
        return;
    }

    req.session.message = message;
    req.session.messageType = 'success';
    res.redirect('/');
};

const clearCustomer = (req) => {
    // Clear our session
    req.session.customerPresent = null;
    req.session.customerEmail = null;
    req.session.customerFirstname = null;
    req.session.customerLastname = null;
    req.session.customerAddress1 = null;
    req.session.customerAddress2 = null;
    req.session.customerCountry = null;
    req.session.customerState = null;
    req.session.customerPostcode = null;
    req.session.customerPhone = null;
    req.session.orderComment = null;
};

const updateSubscriptionCheck = (req, res) => {
    // If cart is empty
    if(!req.session.cart || req.session.cart.length === 0){
        req.session.cartSubscription = null;
        return;
    }

    Object.keys(req.session.cart).forEach((item) => {
        if(item.productSubscription){
            req.session.cartSubscription = item.productSubscription;
        }else{
            req.session.cartSubscription = null;
        }
    });
};

const checkDirectorySync = (directory) => {
    try{
        fs.statSync(directory);
    }catch(e){
        try{
            fs.mkdirSync(directory);
        }catch(err){
           mkdirp.sync(directory);// error : directory & sub directories to be newly created
        }
    }
};

const getThemes = () => {
    return fs.readdirSync(path.join(__dirname, '../', 'views', 'themes')).filter(file => fs.statSync(path.join(path.join(__dirname, '../', 'views', 'themes'), file)).isDirectory());
};

const getImages = async (id, req, res, callback) => {
    const db = req.app.db;

    const product = await db.products.findOne({ _id: getId(id) });
    if(!product){
        return [];
    }

    // loop files in /public/uploads/
    const files = await glob.sync(`public/uploads/${product._id.toString()}/**`, { nosort: true });

    // sort array
    files.sort();

    // declare the array of objects
    const fileList = [];

    // loop these files
    for(let i = 0; i < files.length; i++){
        // only want files
        if(fs.lstatSync(files[i]).isDirectory() === false){
            // declare the file object and set its values
            const file = {
                id: i,
                path: files[i].substring(6)
            };
            if(product.productImage === files[i].substring(6)){
                file.productImage = true;
            }
            // push the file object into the array
            fileList.push(file);
        }
    }
    return fileList;
};

const getConfig = () => {
    let config = JSON.parse(fs.readFileSync(path.join(__dirname, '../config', 'settings.json'), 'utf8'));
    const localConfigFilePath = path.join(__dirname, '../config', 'settings-local.json');

    // Check for local config file and merge with base settings
    if(fs.existsSync(localConfigFilePath)){
        const localConfigFile = JSON.parse(fs.readFileSync(localConfigFilePath, 'utf8'));
        config = Object.assign(config, localConfigFile);
    }

    // Override from env.yaml environment file
    Object.keys(config).forEach((configKey) => {
        if(process.env[configKey]){
            config[configKey] = process.env[configKey];
        }
    });

    config.customCss = typeof config.customCss !== 'undefined' ? escape.decode(config.customCss) : null;
    config.footerHtml = typeof config.footerHtml !== 'undefined' ? escape.decode(config.footerHtml) : null;
    config.googleAnalytics = typeof config.googleAnalytics !== 'undefined' ? escape.decode(config.googleAnalytics) : null;

    // setup theme
    config.themeViews = '';
    if(typeof config.theme === 'undefined' || config.theme === ''){
        config.theme = 'Cloth'; // Default to Cloth theme
    }

    config.themeViews = '../views/themes/' + config.theme + '/';

    // set the environment for files
    config.env = '.min';
    if(process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined){
        config.env = '';
    }

    // load modules
    try{
        config.modules.loaded = {};
        Object.keys(config.modules.enabled).forEach((mod) => {
            config.modules.loaded[mod] = require(`./modules/${config.modules.enabled[mod]}`);
        });
    }catch(ex){
        console.log('Could not load modules, check your config.', ex);
        process.exit(1);
    }

    return config;
};

const getPaymentConfig = () => {
    const siteConfig = getConfig();
    const gateConfigFile = path.join(__dirname, '../config', 'payment', 'config', `${siteConfig.paymentGateway}.json`);

    let config = [];
    if(fs.existsSync(gateConfigFile)){
        config = JSON.parse(fs.readFileSync(gateConfigFile, 'utf8'));
    }

    // Override from env.yaml environment file
    Object.keys(config).forEach((configKey) => {
        if(process.env[configKey]){
            config[configKey] = process.env[configKey];
        }
    });

    return config;
};

const updateConfig = (fields) => {
    const settingsFile = getConfig();

    _.forEach(fields, (value, key) => {
        settingsFile[key] = value;
        if(key === 'customCss_input'){
            settingsFile.customCss = escape.encode(uglifycss.processString(value));
        }
        if(key === 'footerHtml_input'){
            const footerHtml = typeof value !== 'undefined' || value === '' ? escape.encode(value) : '';
            settingsFile.footerHtml = footerHtml;
        }
        if(key === 'googleAnalytics_input'){
            const googleAnalytics = typeof value !== 'undefined' ? escape.encode(value) : '';
            settingsFile.googleAnalytics = googleAnalytics;
        }
    });

    // delete any settings
    delete settingsFile.customCss_input;
    delete settingsFile.footerHtml_input;
    delete settingsFile.googleAnalytics_input;

    if(fields.emailSecure === 'on'){
        settingsFile.emailSecure = true;
    }else{
        settingsFile.emailSecure = false;
    }

    if(fields.emailPort){
        settingsFile.emailPort = parseInt(fields.emailPort);
    }

    if(fields.productsPerRow){
        settingsFile.productsPerRow = parseInt(fields.productsPerRow);
    }

    if(fields.productsPerPage){
        settingsFile.productsPerPage = parseInt(fields.productsPerPage);
    }

    // If we have a local settings file (not git tracked) we loop its settings and save
    // and changes made to them. All other settings get updated to the base settings file.
    const localSettingsFile = path.join(__dirname, '../config', 'settings-local.json');
    if(fs.existsSync(localSettingsFile)){
        const localSettings = JSON.parse(fs.readFileSync(localSettingsFile));
        _.forEach(localSettings, (value, key) => {
            if(fields[key]){
                localSettings[key] = fields[key];

                // Exists in local so remove from main settings file
                delete settingsFile[key];
            }
        });
        // Save our local settings
        try{
            fs.writeFileSync(localSettingsFile, JSON.stringify(localSettings, null, 4));
        }catch(exception){
            console.log('Failed to save local settings file', exception);
        }
    }

    // write base settings file
    const baseSettingsFile = path.join(__dirname, '../config', 'settings.json');
    try{
        fs.writeFileSync(baseSettingsFile, JSON.stringify(settingsFile, null, 4));
        return true;
    }catch(exception){
        return false;
    }
};

const updateConfigLocal = (field) => {
    const localSettingsFile = path.join(__dirname, '../config', 'settings-local.json');
    try{
        let localSettings = {};
        if(fs.existsSync(localSettingsFile)){
            localSettings = JSON.parse(fs.readFileSync(localSettingsFile));
        }
        Object.assign(localSettings, field);
        fs.writeFileSync(localSettingsFile, JSON.stringify(localSettings, null, 4));
    }catch(exception){
        console.log('Failed to save local settings file', exception);
    }
};

const getMenu = (db) => {
    return db.menu.findOne({});
};

// creates a new menu item
const newMenu = (req) => {
    const db = req.app.db;
    return getMenu(db)
    .then((menu) => {
        // if no menu present
        if(!menu){
            menu = {};
            menu.items = [];
        }
        const newNav = {
            title: req.body.navMenu,
            link: req.body.navLink,
            order: Object.keys(menu.items).length + 1
        };

        menu.items.push(newNav);
        return db.menu.updateOne({}, { $set: { items: menu.items } }, { upsert: true })
        .then(() => {
            return true;
        });
    })
    .catch((err) => {
        console.log('Error creating new menu', err);
        return false;
    });
};

// delete a menu item
const deleteMenu = (req, menuIndex) => {
    const db = req.app.db;
    return getMenu(db)
    .then((menu) => {
        // Remove menu item
        menu.items.splice(menuIndex, 1);
        return db.menu.updateOne({}, { $set: { items: menu.items } }, { upsert: true })
        .then(() => {
            return true;
        });
    })
    .catch(() => {
        return false;
    });
};

// updates and existing menu item
const updateMenu = (req) => {
    const db = req.app.db;
    return getMenu(db)
    .then((menu) => {
        // find menu item and update it
        const menuIndex = _.findIndex(menu.items, ['title', req.body.navId]);
        menu.items[menuIndex].title = req.body.navMenu;
        menu.items[menuIndex].link = req.body.navLink;
        return db.menu.updateOne({}, { $set: { items: menu.items } }, { upsert: true })
        .then(() => {
            return true;
        });
    })
    .catch(() => {
        return false;
    });
};

const sortMenu = (menu) => {
    if(menu && menu.items){
        menu.items = _.sortBy(menu.items, 'order');
        return menu;
    }
    return {};
};

// orders the menu
const orderMenu = (req, res) => {
    const db = req.app.db;
    return getMenu(db)
    .then((menu) => {
        const menuOrder = req.body['order[]'];
        // update the order
        for(let i = 0; i < menuOrder.length; i++){
            _.find(menu.items, ['title', menuOrder[i]]).order = i;
        }
        return db.menu.updateOne({}, { $set: { items: menu.items } }, { upsert: true })
        .then(() => {
            return true;
        });
    })
    .catch(() => {
        return false;
    });
};

const getEmailTemplate = (result) => {
    const config = getConfig();

    const template = fs.readFileSync(path.join(__dirname, '../public/email_template.html'), 'utf8');

    $ = cheerio.load(template);
    $('#brand').text(config.cartTitle);
    $('#paymentResult').text(result.message);
    if(result.paymentApproved === true){
        $('#paymentResult').addClass('text-success');
    }else{
        $('#paymentResult').addClass('text-danger');
    }
    $('#paymentMessage').text('Thanks for shopping with us. We hope you will shop with us again soon.');
    $('#paymentDetails').html(result.paymentDetails);

    return $.html();
};

const sendEmail = (to, subject, body) => {
    const config = getConfig();

    const emailSettings = {
        host: config.emailHost,
        port: config.emailPort,
        secure: config.emailSecure,
        auth: {
            user: config.emailUser,
            pass: config.emailPassword
        }
    };

    // outlook needs this setting
    if(config.emailHost === 'smtp-mail.outlook.com'){
        emailSettings.tls = { ciphers: 'SSLv3' };
    }

    const transporter = nodemailer.createTransport(emailSettings);

    const mailOptions = {
        from: config.emailAddress, // sender address
        to: to, // list of receivers
        subject: subject, // Subject line
        html: body// html body
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if(error){
            return console.error(colors.red(error));
        }
        return true;
    });
};

// gets the correct type of index ID
const getId = (id) => {
    if(id){
        if(id.length !== 24){
            return id;
        }
    }
    return ObjectId(id);
};

const newId = () => {
    return new ObjectId();
};

/**
 * @param  {boolean} frontend // whether or not this is an front or admin call
 * @param  {req} req // express `req` object
 * @param  {integer} page // The page number
 * @param  {string} collection // The collection to search
 * @param  {object} query // The mongo query
 * @param  {object} sort // The mongo sort
 */
const paginateData = (frontend, req, page, collection, query, sort) => {
    const db = req.app.db;
    const config = getConfig();
    let numberItems = 10;
    if(frontend){
        numberItems = config.productsPerPage ? config.productsPerPage : 6;
    }

    let skip = 0;
    if(page > 1){
        skip = (page - 1) * numberItems;
    }

    if(!query){
        query = {};
    }
    if(!sort){
        sort = {};
    }

    // Run our queries
    return Promise.all([
        db[collection].find(query).skip(skip).limit(parseInt(numberItems)).sort(sort).toArray(),
        db[collection].countDocuments(query)
    ])
    .then((result) => {
        const returnData = { data: result[0], totalItems: result[1] };
        return returnData;
    })
    .catch((err) => {
        throw new Error('Error retrieving paginated data');
    });
};

/**
 * @param  {boolean} frontend // whether or not this is an front or admin call
 * @param  {req} req // express `req` object
 * @param  {integer} page // The page number
 * @param  {string} collection // The collection to search
 * @param  {object} query // The mongo query
 * @param  {object} sort // The mongo sort
 */
const paginateProducts = (frontend, db, page, query, sort) => {
    const config = getConfig();
    let numberItems = 10;
    if(frontend){
        numberItems = config.productsPerPage ? config.productsPerPage : 6;
    }

    let skip = 0;
    if(page > 1){
        skip = (page - 1) * numberItems;
    }

    if(!query){
        query = {};
    }
    if(!sort){
        sort = {};
    }

    // Run our queries
    return Promise.all([
        db.products.aggregate([
            { $match: query },
            {
                $lookup: {
                    from: 'variants',
                    localField: '_id',
                    foreignField: 'product',
                    as: 'variants'
                }
            }
        ]).sort(sort).skip(skip).limit(parseInt(numberItems)).toArray(),
        db.products.countDocuments(query)
    ])
    .then((result) => {
        const returnData = { data: result[0], totalItems: result[1] };
        return returnData;
    })
    .catch((err) => {
        throw new Error('Error retrieving paginated data');
    });
};

const getSort = () => {
    const config = getConfig();
    let sortOrder = -1;
    if(config.productOrder === 'ascending'){
        sortOrder = 1;
    }
    let sortField = 'productAddedDate';
    if(config.productOrderBy === 'title'){
        sortField = 'productTitle';
    }

    return {
        [sortField]: sortOrder
    };
};

const hooker = (order) => {
    const config = getConfig();

    return axios.post(config.orderHook, order, { responseType: 'application/json' })
    .then((response) => {
        if(response.status === 200){
            console.info('Successfully called order hook');
        }
    })
    .catch((err) => {
        console.log('Error calling hook:', err);
    });
};

const getCountryList = () => {
    return countryArray;
};

const cleanAmount = (amount) => {
    if(amount){
        return parseInt(amount.toString().replace('.', ''));
    }
    return amount;
};

module.exports = {
    allowedMimeType,
    fileSizeLimit,
    cleanHtml,
    mongoSanitize,
    safeParseInt,
    checkboxBool,
    convertBool,
    addSitemapProducts,
    clearSessionValue,
    updateTotalCart,
    emptyCart,
    clearCustomer,
    updateSubscriptionCheck,
    checkDirectorySync,
    getThemes,
    getImages,
    getConfig,
    getPaymentConfig,
    updateConfig,
    updateConfigLocal,
    getMenu,
    newMenu,
    deleteMenu,
    updateMenu,
    sortMenu,
    orderMenu,
    getEmailTemplate,
    sendEmail,
    getId,
    newId,
    paginateData,
    paginateProducts,
    getSort,
    hooker,
    getCountryList,
    cleanAmount
};
