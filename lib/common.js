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
    return false;
};

const convertBool = (value) => {
    if(value === 'true' || value === true){
        return true;
    }
    return false;
};

const showCartCloseBtn = (page) => {
    let showCartCloseButton = true;
    if(page === 'checkout' || page === 'pay'){
        showCartCloseButton = false;
    }

    return showCartCloseButton;
};

// adds products to sitemap.xml
const addSitemapProducts = (req, res, cb) => {
    let db = req.app.db;

    let config = getConfig();
    let hostname = config.baseUrl;

    db.products.find({ productPublished: 'true' }).toArray((err, products) => {
        let posts = [];
        if(err){
            cb(null, posts);
        }
        async.eachSeries(products, (item, callback) => {
            let post = {};
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

const updateTotalCartAmount = (req, res) => {
    let config = getConfig();

    req.session.totalCartAmount = 0;

    _(req.session.cart).forEach((item) => {
        req.session.totalCartAmount = req.session.totalCartAmount + item.totalItemPrice;
    });

    // under the free shipping threshold
    if(req.session.totalCartAmount < config.freeShippingAmount){
        req.session.totalCartAmount = req.session.totalCartAmount + parseInt(config.flatShipping);
        req.session.shippingCostApplied = true;
    }else{
        req.session.shippingCostApplied = false;
    }
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

const getImages = (dir, req, res, callback) => {
    let db = req.app.db;

    db.products.findOne({ _id: getId(dir) }, (err, product) => {
        if(err){
            console.error(colors.red('Error getting images', err));
        }

        // loop files in /public/uploads/
        glob('public/uploads/' + product.productPermalink + '/**', { nosort: true }, (er, files) => {
            // sort array
            files.sort();

            // declare the array of objects
            let fileList = [];

            // loop these files
            for(let i = 0; i < files.length; i++){
                // only want files
                if(fs.lstatSync(files[i]).isDirectory() === false){
                    // declare the file object and set its values
                    let file = {
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
            callback(fileList);
        });
    });
};

const getConfig = () => {
    let config = JSON.parse(fs.readFileSync(path.join(__dirname, '../config', 'settings.json'), 'utf8'));
    const localConfigFilePath = path.join(__dirname, '../config', 'settings-local.json');

    // Check for local config file and merge with base settings
    if(fs.existsSync(localConfigFilePath)){
        const localConfigFile = JSON.parse(fs.readFileSync(localConfigFilePath, 'utf8'));
        config = Object.assign(config, localConfigFile);
    }

    config.customCss = typeof config.customCss !== 'undefined' ? escape.decode(config.customCss) : null;
    config.footerHtml = typeof config.footerHtml !== 'undefined' ? escape.decode(config.footerHtml) : null;
    config.googleAnalytics = typeof config.googleAnalytics !== 'undefined' ? escape.decode(config.googleAnalytics) : null;

    // set the environment for files
    config.env = '.min';
    if(process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined){
        config.env = '';
    }

    // setup theme
    config.themeViews = '';
    if(typeof config.theme === 'undefined' || config.theme === ''){
        config.theme = 'Cloth'; // Default to Cloth theme
    }

    config.themeViews = '../views/themes/' + config.theme + '/';

    // if db set to mongodb override connection with MONGODB_CONNECTION_STRING env var
    config.databaseConnectionString = process.env.MONGODB_CONNECTION_STRING || config.databaseConnectionString;

    return config;
};

const getPaymentConfig = () => {
    let siteConfig = getConfig();
    const gateConfigFile = path.join(__dirname, '../config', `${siteConfig.paymentGateway}.json`);

    let config = [];
    if(fs.existsSync(gateConfigFile)){
        config = JSON.parse(fs.readFileSync(gateConfigFile, 'utf8'));
    }

    // If a local config we combine the objects. Local configs are .gitignored
    let localConfig = path.join(__dirname, '../config', `${siteConfig.paymentGateway}-local.json`);
    if(fs.existsSync(localConfig)){
        const localConfigObj = JSON.parse(fs.readFileSync(localConfig, 'utf8'));
        config = Object.assign(config, localConfigObj);
    }

    return config;
};

const updateConfig = (fields) => {
    let settingsFile = getConfig();

    _.forEach(fields, (value, key) => {
        settingsFile[key] = value;
        if(key === 'customCss_input'){
            settingsFile['customCss'] = escape.encode(uglifycss.processString(value));
        }
        if(key === 'footerHtml_input'){
            let footerHtml = typeof value !== 'undefined' || value === '' ? escape.encode(value) : '';
            settingsFile['footerHtml'] = footerHtml;
        }
        if(key === 'googleAnalytics_input'){
            let googleAnalytics = typeof value !== 'undefined' ? escape.encode(value) : '';
            settingsFile['googleAnalytics'] = googleAnalytics;
        }
    });

    // delete settings
    delete settingsFile['customCss_input'];
    delete settingsFile['footerHtml_input'];
    delete settingsFile['googleAnalytics_input'];

    if(fields['emailSecure'] === 'on'){
        settingsFile['emailSecure'] = true;
    }else{
        settingsFile['emailSecure'] = false;
    }

    if(!fields['menuEnabled']){
        settingsFile['menuEnabled'] = false;
    }else{
        settingsFile['menuEnabled'] = true;
    }

    if(fields['emailPort']){
        settingsFile['emailPort'] = parseInt(fields['emailPort']);
    }

    if(fields['flatShipping']){
        settingsFile['flatShipping'] = parseInt(fields['flatShipping']);
    }

    if(fields['freeShippingAmount']){
        settingsFile['freeShippingAmount'] = parseInt(fields['freeShippingAmount']);
    }

    if(fields['productsPerRow']){
        settingsFile['productsPerRow'] = parseInt(fields['productsPerRow']);
    }

    if(fields['productsPerPage']){
        settingsFile['productsPerPage'] = parseInt(fields['productsPerPage']);
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

const getMenu = (db) => {
    return db.menu.findOne({});
};

// creates a new menu item
const newMenu = (req, res) => {
    const db = req.app.db;
    return getMenu(db)
    .then((menu) => {
        // if no menu present
        if(!menu){
            menu = {};
            menu.items = [];
        }
        let newNav = {
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
const deleteMenu = (req, res, menuIndex) => {
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
const updateMenu = (req, res) => {
    const db = req.app.db;
    return getMenu(db)
    .then((menu) => {
        // find menu item and update it
        let menuIndex = _.findIndex(menu.items, ['title', req.body.navId]);
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
    return{};
};

// orders the menu
const orderMenu = (req, res) => {
    const db = req.app.db;
    return getMenu(db)
    .then((menu) => {
        // update the order
        for(let i = 0; i < req.body.navId.length; i++){
            _.find(menu.items, ['title', req.body.navId[i]]).order = i;
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
    let config = getConfig();

    let template = fs.readFileSync(path.join(__dirname, '../public/email_template.html'), 'utf8');

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
    let config = getConfig();

    let emailSettings = {
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

    let transporter = nodemailer.createTransport(emailSettings);

    let mailOptions = {
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

const getData = (req, page, query) => {
    let db = req.app.db;
    let config = getConfig();
    let numberProducts = config.productsPerPage ? config.productsPerPage : 6;

    let skip = 0;
    if(page > 1){
        skip = (page - 1) * numberProducts;
    }

    if(!query){
        query = {};
    }

    query['productPublished'] = 'true';

    // Run our queries
    return Promise.all([
        db.products.find(query).skip(skip).limit(parseInt(numberProducts)).toArray(),
        db.products.count(query)
    ])
    .then((result) => {
        const returnData = { data: result[0], totalProducts: result[1] };
        return returnData;
    })
    .catch((err) => {
        throw new Error('Error retrieving products');
    });
};

const hooker = (order) => {
    let config = getConfig();

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

module.exports = {
    allowedMimeType,
    fileSizeLimit,
    cleanHtml,
    mongoSanitize,
    safeParseInt,
    checkboxBool,
    convertBool,
    showCartCloseBtn,
    addSitemapProducts,
    clearSessionValue,
    updateTotalCartAmount,
    checkDirectorySync,
    getThemes,
    getImages,
    getConfig,
    getPaymentConfig,
    updateConfig,
    getMenu,
    newMenu,
    deleteMenu,
    updateMenu,
    sortMenu,
    orderMenu,
    getEmailTemplate,
    sendEmail,
    getId,
    getData,
    hooker
};
