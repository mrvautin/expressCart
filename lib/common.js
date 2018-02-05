const _ = require('lodash');
const uglifycss = require('uglifycss');
const colors = require('colors');
const lunr = require('lunr');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const glob = require('glob');
const async = require('async');
const nodemailer = require('nodemailer');
const escape = require('html-entities').AllHtmlEntities;
let ObjectId = require('mongodb').ObjectID;

// common functions
exports.checkLogin = (req, res, next) => {
    // if not protecting we check for public pages and don't checkLogin
    if(req.session.needsSetup === true){
        res.redirect('/admin/setup');
        return;
    }

    if(req.session.user){
        next();
        return;
    }
    res.redirect('/admin/login');
};

exports.showCartCloseBtn = (page) => {
    let showCartCloseButton = true;
    if(page === 'checkout' || page === 'pay'){
        showCartCloseButton = false;
    }

    return showCartCloseButton;
};

// adds products to sitemap.xml
exports.addSitemapProducts = (req, res, cb) => {
    let db = req.app.db;

    let config = exports.getConfig();
    let hostname = config.baseUrl;

    db.products.find({productPublished: 'true'}).toArray((err, products) => {
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

exports.restrict = (req, res, next) => {
    exports.checkLogin(req, res, next);
};

exports.clearSessionValue = (session, sessionVar) => {
    let temp;
    if(session){
        temp = session[sessionVar];
        session[sessionVar] = null;
    }
    return temp;
};

exports.updateTotalCartAmount = (req, res) => {
    let config = exports.getConfig();

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

exports.checkDirectorySync = (directory) => {
    try{
        fs.statSync(directory);
    }catch(e){
        fs.mkdirSync(directory);
    }
};

exports.getThemes = () => {
    return fs.readdirSync(path.join('public', 'themes')).filter(file => fs.statSync(path.join(path.join('public', 'themes'), file)).isDirectory());
};

exports.getImages = (dir, req, res, callback) => {
    let db = req.app.db;

    db.products.findOne({_id: exports.getId(dir)}, (err, product) => {
        if(err){
            console.error(colors.red('Error getting images', err));
        }

        // loop files in /public/uploads/
        glob('public/uploads/' + product.productPermalink + '/**', {nosort: true}, (er, files) => {
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

exports.getConfig = () => {
    let config = JSON.parse(fs.readFileSync(path.join(__dirname, '../config', 'settings.json'), 'utf8'));
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
    if(typeof config.theme !== 'undefined' && config.theme !== ''){
        config.themeViews = '../public/themes/' + config.theme + '/';
    }

    // if db set to mongodb override connection with MONGODB_CONNECTION_STRING env var
    config.databaseConnectionString = process.env.MONGODB_CONNECTION_STRING || config.databaseConnectionString;

    return config;
};

exports.getPaymentConfig = () => {
    let siteConfig = this.getConfig();

    let config = [];
    if(fs.existsSync(path.join(__dirname, '../config/' + siteConfig.paymentGateway + '.json'))){
        config = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/' + siteConfig.paymentGateway + '.json'), 'utf8'));
    }

    return config;
};

exports.updateConfig = (fields) => {
    let settingsFile = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/settings.json'), 'utf8'));

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

    // write file
    try{
        fs.writeFileSync(path.join(__dirname, '../config/settings.json'), JSON.stringify(settingsFile, null, 4));
        return true;
    }catch(exception){
        return false;
    }
};

exports.getMenu = (db) => {
    return db.menu.findOne({});
};

// creates a new menu item
exports.newMenu = (req, res) => {
    const db = req.app.db;
    return exports.getMenu(db)
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
        return db.menu.updateOne({}, {$set: {items: menu.items}}, {upsert: true})
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
exports.deleteMenu = (req, res, menuIndex) => {
    const db = req.app.db;
    return exports.getMenu(db)
    .then((menu) => {
        // Remove menu item
        menu.items.splice(menuIndex, 1);
        return db.menu.updateOne({}, {$set: {items: menu.items}}, {upsert: true})
        .then(() => {
            return true;
        });
    })
    .catch(() => {
        return false;
    });
};

// updates and existing menu item
exports.updateMenu = (req, res) => {
    const db = req.app.db;
    return exports.getMenu(db)
    .then((menu) => {
        // find menu item and update it
        let menuIndex = _.findIndex(menu.items, ['title', req.body.navId]);
        menu.items[menuIndex].title = req.body.navMenu;
        menu.items[menuIndex].link = req.body.navLink;
        return db.menu.updateOne({}, {$set: {items: menu.items}}, {upsert: true})
        .then(() => {
            return true;
        });
    })
    .catch(() => {
        return false;
    });
};

exports.sortMenu = (menu) => {
    if(menu && menu.items){
        menu.items = _.sortBy(menu.items, 'order');
        return menu;
    }
    return{};
};

// orders the menu
exports.orderMenu = (req, res) => {
    const db = req.app.db;
    return exports.getMenu(db)
    .then((menu) => {
        // update the order
        for(let i = 0; i < req.body.navId.length; i++){
            _.find(menu.items, ['title', req.body.navId[i]]).order = i;
        }
        return db.menu.updateOne({}, {$set: {items: menu.items}}, {upsert: true})
        .then(() => {
            return true;
        });
    })
    .catch(() => {
        return false;
    });
};

exports.getEmailTemplate = (result) => {
    let config = this.getConfig();

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

exports.sendEmail = (to, subject, body) => {
    let config = this.getConfig();

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
        emailSettings.tls = {ciphers: 'SSLv3'};
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
exports.getId = (id) => {
    if(id){
        if(id.length !== 24){
            return id;
        }
    }
    return ObjectId(id);
};

exports.getData = (req, page, query) => {
    let db = req.app.db;
    let config = exports.getConfig();
    let numberProducts = config.productsPerPage ? config.productsPerPage : 6;

    let skip = 0;
    if(page > 1){
        skip = (page - 1) * numberProducts;
    }

    query['productPublished'] = 'true';

    // Run our queries
    return Promise.all([
        db.products.find(query).skip(skip).limit(parseInt(numberProducts)).toArray(),
        db.products.count(query)
    ])
    .then((result) => {
        const returnData = {data: result[0], totalProducts: result[1]};
        return returnData;
    })
    .catch((err) => {
        throw new Error('Error retrieving products');
    });
};

exports.indexProducts = (app) => {
    // index all products in lunr on startup
    return new Promise((resolve, reject) => {
        app.db.products.find({}).toArray((err, productsList) => {
            if(err){
                console.error(colors.red(err.stack));
                reject(err);
            }

            // setup lunr indexing
            const productsIndex = lunr(function(){
                this.field('productTitle', {boost: 10});
                this.field('productTags', {boost: 5});
                this.field('productDescription');

                const lunrIndex = this;

                // add to lunr index
                productsList.forEach((product) => {
                    let doc = {
                        'productTitle': product.productTitle,
                        'productTags': product.productTags,
                        'productDescription': product.productDescription,
                        'id': product._id
                    };
                    lunrIndex.add(doc);
                });
            });

            app.productsIndex = productsIndex;
            console.log(colors.cyan('- Product indexing complete'));
            resolve();
        });
    });
};

exports.indexCustomers = (app) => {
    // index all products in lunr on startup
    return new Promise((resolve, reject) => {
        app.db.customers.find({}).toArray((err, customerList) => {
            if(err){
                console.error(colors.red(err.stack));
                reject(err);
            }

            // setup lunr indexing
            const customersIndex = lunr(function(){
                this.field('email', {boost: 10});
                this.field('name', {boost: 5});
                this.field('phone');

                const lunrIndex = this;

                // add to lunr index
                customerList.forEach((customer) => {
                    let doc = {
                        'email': customer.email,
                        'name': `${customer.firstName} ${customer.lastName}`,
                        'phone': customer.phone,
                        'id': customer._id
                    };
                    lunrIndex.add(doc);
                });
            });

            app.customersIndex = customersIndex;
            console.log(colors.cyan('- Customer indexing complete'));
            resolve();
        });
    });
};

exports.indexOrders = (app, cb) => {
    // index all orders in lunr on startup
    return new Promise((resolve, reject) => {
        app.db.orders.find({}).toArray((err, ordersList) => {
            if(err){
                console.error(colors.red('Error setting up products index: ' + err));
                reject(err);
            }

            // setup lunr indexing
            const ordersIndex = lunr(function(){
                this.field('orderEmail', {boost: 10});
                this.field('orderLastname', {boost: 5});
                this.field('orderPostcode');

                const lunrIndex = this;

                // add to lunr index
                ordersList.forEach((order) => {
                    let doc = {
                        'orderLastname': order.orderLastname,
                        'orderEmail': order.orderEmail,
                        'orderPostcode': order.orderPostcode,
                        'id': order._id
                    };
                    lunrIndex.add(doc);
                });
            });

            app.ordersIndex = ordersIndex;
            console.log(colors.cyan('- Order indexing complete'));
            resolve();
        });
    });
};

// start indexing products and orders
exports.runIndexing = (app) => {
    console.info(colors.yellow('Setting up indexes..'));

    return Promise.all([
        exports.indexProducts(app),
        exports.indexOrders(app),
        exports.indexCustomers(app)
    ])
    .catch((err) => {
        process.exit(2);
    });
};

exports.testData = (db, app) => {
    db.products.count({})
    .then((products) => {
        if(products > 0){
            return Promise.resolve();
        }

        console.info(colors.cyan('No products, inserting test data'));

        const testData = fs.readFileSync('./bin/testdata.json', 'utf-8');
        const jsonData = JSON.parse(testData);
        return Promise.all([
            db.products.insertMany(jsonData.products),
            db.menu.insertOne(jsonData.menu),
            exports.runIndexing(app)
        ])
        .catch((err) => {
            console.info(colors.red('Error inserting test data. Check `/bin/testdata.json` is correctly formatted.', err));
            process.exit(2);
        });
    });
};
