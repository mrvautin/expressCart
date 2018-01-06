let _ = require('lodash');
let uglifycss = require('uglifycss');
let colors = require('colors');
let escape = require('html-entities').AllHtmlEntities;

// common functions
exports.checkLogin = function(req, res, next){
    // if not protecting we check for public pages and don't checkLogin
    if(req.session.needsSetup === true){
        res.redirect('/setup');
        return;
    }

    if(req.session.user){
        next();
        return;
    }
    res.redirect('/login');
};

exports.showCartCloseBtn = function(page){
    let showCartCloseButton = true;
    if(page === 'checkout' || page === 'pay'){
        showCartCloseButton = false;
    }

    return showCartCloseButton;
};

// adds products to sitemap.xml
exports.addSitemapProducts = function(req, res, cb){
    let db = req.app.db;
    let async = require('async');
    let config = this.getConfig();
    let hostname = config.baseUrl;

    exports.dbQuery(db.products, {productPublished: 'true'}, null, null, (err, products) => {
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

exports.restrict = function(req, res, next){
    exports.checkLogin(req, res, next);
};

exports.clearSessionValue = function(session, sessionVar){
    let temp;
    if(session){
        temp = session[sessionVar];
        session[sessionVar] = null;
    }
    return temp;
};

exports.updateTotalCartAmount = function(req, res){
    let config = this.getConfig();

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

exports.checkDirectorySync = function (directory){
    let fs = require('fs');
    try{
        fs.statSync(directory);
    }catch(e){
        fs.mkdirSync(directory);
    }
};

exports.getThemes = function (){
    let fs = require('fs');
    let path = require('path');
    return fs.readdirSync(path.join('public', 'themes')).filter(file => fs.statSync(path.join(path.join('public', 'themes'), file)).isDirectory());
};

exports.getImages = function (dir, req, res, callback){
    let db = req.app.db;
    let glob = require('glob');
    let fs = require('fs');

    db.products.findOne({_id: exports.getId(dir)}, (err, product) => {
        if(err){
            console.error(colors.red('Error getting images', err));
        }
        // loop files in /public/uploads/
        glob('public/uploads/' + dir + '/**', {nosort: true}, (er, files) => {
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

exports.getConfig = function(){
    let fs = require('fs');
    let path = require('path');

    console.log('getting config');

    let config = JSON.parse(fs.readFileSync(path.join(__dirname, '../config', 'settings.json'), 'utf8'));
    config.customCss = typeof config.customCss !== 'undefined' ? escape.decode(config.customCss) : null;
    config.footerHtml = typeof config.footerHtml !== 'undefined' ? escape.decode(config.footerHtml) : null;
    config.googleAnalytics = typeof config.googleAnalytics !== 'undefined' ? escape.decode(config.googleAnalytics) : null;

    // set the environment for files
    config.env = '.min';
    if(process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined){
        config.env = '';
    }

    // default DB to embedded
    if(typeof config.databaseType === 'undefined'){
        config.databaseType = 'embedded';
    }

    // setup theme
    config.themeViews = '';
    if(typeof config.theme !== 'undefined' && config.theme !== ''){
        config.themeViews = '../public/themes/' + config.theme + '/';
    }

    // if db set to mongodb override connection with MONGODB_CONNECTION_STRING env var
    if(config.databaseType === 'mongodb'){
        config.databaseConnectionString = process.env.MONGODB_CONNECTION_STRING || config.databaseConnectionString;
    }

    console.log('got config');

    return config;
};

exports.getPaymentConfig = function(){
    let fs = require('fs');
    let path = require('path');
    let siteConfig = this.getConfig();

    let config = [];
    if(fs.existsSync(path.join(__dirname, '../config/' + siteConfig.paymentGateway + '.json'))){
        config = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/' + siteConfig.paymentGateway + '.json'), 'utf8'));
    }

    return config;
};

exports.updateConfig = function(fields){
    let fs = require('fs');
    let path = require('path');
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
        settingsFile['menuEnabled'] = 'false';
    }else{
        settingsFile['menuEnabled'] = 'true';
    }

    // write file
    try{
        fs.writeFileSync(path.join(__dirname, '../config/settings.json'), JSON.stringify(settingsFile, null, 4));
        return true;
    }catch(exception){
        return false;
    }
};

exports.getMenu = function(){
    let fs = require('fs');
    let path = require('path');
    let menuFile = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/menu.json'), 'utf8'));

    menuFile.items = _.sortBy(menuFile.items, 'order');
    return menuFile;
};

// creates a new menu item
exports.newMenu = function(req, res){
    let fs = require('fs');
    let path = require('path');
    let menuJson = '../config/menu.json';
    let menuFile = require(menuJson);

    let newNav = {
        title: req.body.navMenu,
        link: req.body.navLink,
        order: Object.keys(menuFile.items).length + 1
    };

    // add new menu item
    menuFile.items.push(newNav);

    // write file
    try{
        fs.writeFileSync(path.join(__dirname, '../config/menu.json'), JSON.stringify(menuFile));
        return true;
    }catch(e){
        return false;
    }
};

// delete a menu item
exports.deleteMenu = function(req, res, menuIndex){
    let fs = require('fs');
    let path = require('path');
    let menuJson = '../config/menu.json';
    let menuFile = require(menuJson);

    delete menuFile.items[menuIndex];

    // write file
    try{
        fs.writeFileSync(path.join(__dirname, '../config/menu.json'), JSON.stringify(menuFile));
        return true;
    }catch(e){
        return false;
    }
};

// updates and existing menu item
exports.updateMenu = function(req, res){
    let fs = require('fs');
    let path = require('path');
    let menuJson = '../config/menu.json';
    let menuFile = require(menuJson);

    // find menu item and update it
    let menuIndex = _.findIndex(menuFile.items, ['title', req.body.navId]);
    menuFile.items[menuIndex].title = req.body.navMenu;
    menuFile.items[menuIndex].link = req.body.navLink;

    // write file
    try{
        fs.writeFileSync(path.join(__dirname, '../config/menu.json'), JSON.stringify(menuFile));
        return true;
    }catch(e){
        return false;
    }
};

exports.getEmailTemplate = function(result){
    let cheerio = require('cheerio');
    let config = this.getConfig();
    let fs = require('fs');
    let path = require('path');

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

exports.sendEmail = function(to, subject, body){
    let config = this.getConfig();
    let nodemailer = require('nodemailer');

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

// orders the menu
exports.orderMenu = function(req, res){
    let fs = require('fs');
    let path = require('path');
    let menuJson = '../config/menu.json';
    let menuFile = require(menuJson);

    // update the order
    for(let i = 0; i < req.body.navId.length; i++){
        _.find(menuFile.items, ['title', req.body.navId[i]]).order = i;
    }

    // write file
    try{
        fs.writeFileSync(path.join(__dirname, '../config/menu.json'), JSON.stringify(menuFile));
        return true;
    }catch(e){
        return false;
    }
};

// gets the correct type of index ID
exports.getId = function(id){
    let config = exports.getConfig();
    let ObjectID = require('mongodb').ObjectID;
    if(config.databaseType === 'embedded'){
        return id;
    }
    if(id){
        if(id.length !== 24){
            return id;
        }
    }
    return ObjectID(id);
};

// run the DB query
exports.dbQuery = function(db, query, sort, limit, callback){
    let config = exports.getConfig();
    if(sort && limit){
        db.find(query).sort(sort).limit(parseInt(limit)).toArray((err, results) => {
            if(err){
                console.error(colors.red(err));
            }
            callback(null, results);
        });
    }else{
        db.find(query).toArray((err, results) => {
            if(err){
                console.error(colors.red(err));
            }
            callback(null, results);
        });
    }
};
