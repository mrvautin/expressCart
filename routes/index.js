const express = require('express');
const router = express.Router();
const colors = require('colors');
const _ = require('lodash');
const randtoken = require('rand-token');
const common = require('./common');

router.get('/payment/:orderId', async (req, res, next) => {
    let db = req.app.db;
    let config = common.getConfig();

    // render the payment complete message
    db.orders.findOne({_id: common.getId(req.params.orderId)}, async (err, result) => {
        if(err){
            console.info(err.stack);
        }
        res.render(`${config.themeViews}payment_complete`, {
            title: 'Payment complete',
            config: common.getConfig(),
            session: req.session,
            pageCloseBtn: common.showCartCloseBtn('payment'),
            result: result,
            message: common.clearSessionValue(req.session, 'message'),
            messageType: common.clearSessionValue(req.session, 'messageType'),
            helpers: req.handlebars.helpers,
            showFooter: 'showFooter',
            menu: common.sortMenu(await common.getMenu(db))
        });
    });
});

router.get('/checkout', async (req, res, next) => {
    let config = common.getConfig();

    // if there is no items in the cart then render a failure
    if(!req.session.cart){
        req.session.message = 'The are no items in your cart. Please add some items before checking out';
        req.session.messageType = 'danger';
        res.redirect('/');
        return;
    }

    // render the checkout
    res.render(`${config.themeViews}checkout`, {
        title: 'Checkout',
        config: common.getConfig(),
        session: req.session,
        pageCloseBtn: common.showCartCloseBtn('checkout'),
        checkout: 'hidden',
        page: 'checkout',
        message: common.clearSessionValue(req.session, 'message'),
        messageType: common.clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers,
        showFooter: 'showFooter'
    });
});

router.get('/pay', async (req, res, next) => {
    let config = common.getConfig();

    // if there is no items in the cart then render a failure
    if(!req.session.cart){
        req.session.message = 'The are no items in your cart. Please add some items before checking out';
        req.session.messageType = 'danger';
        res.redirect('/checkout');
        return;
    }

    // render the payment page
    res.render(`${config.themeViews}pay`, {
        title: 'Pay',
        config: common.getConfig(),
        paymentConfig: common.getPaymentConfig(),
        pageCloseBtn: common.showCartCloseBtn('pay'),
        session: req.session,
        paymentPage: true,
        page: 'pay',
        message: common.clearSessionValue(req.session, 'message'),
        messageType: common.clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers,
        showFooter: 'showFooter'
    });
});

router.get('/cartPartial', (req, res) => {
    res.render('partials/cart', {
        pageCloseBtn: common.showCartCloseBtn(req.query.path),
        page: req.query.path,
        layout: false,
        helpers: req.handlebars.helpers,
        config: common.getConfig(),
        session: req.session
    });
});

// show an individual product
router.get('/product/:id', (req, res) => {
    let db = req.app.db;
    let config = common.getConfig();

    db.products.findOne({$or: [{_id: common.getId(req.params.id)}, {productPermalink: req.params.id}]}, (err, result) => {
        // render 404 if page is not published
        if(err){
            res.render('error', {message: '404 - Page not found', helpers: req.handlebars.helpers});
        }
        if(err || result == null || result.productPublished === 'false'){
            res.render('error', {message: '404 - Page not found', helpers: req.handlebars.helper});
        }else{
            let productOptions = {};
            if(result.productOptions){
                productOptions = JSON.parse(result.productOptions);
            }

            // show the view
            common.getImages(result._id, req, res, async (images) => {
                res.render(`${config.themeViews}product`, {
                    title: result.productTitle,
                    result: result,
                    productOptions: productOptions,
                    images: images,
                    productDescription: result.productDescription,
                    metaDescription: config.cartTitle + ' - ' + result.productTitle,
                    pageCloseBtn: common.showCartCloseBtn('product'),
                    config: config,
                    session: req.session,
                    pageUrl: config.baseUrl + req.originalUrl,
                    message: common.clearSessionValue(req.session, 'message'),
                    messageType: common.clearSessionValue(req.session, 'messageType'),
                    helpers: req.handlebars.helpers,
                    showFooter: 'showFooter',
                    menu: common.sortMenu(await common.getMenu(db))
                });
            });
        }
    });
});

// logout
router.get('/logout', (req, res) => {
    req.session.user = null;
    req.session.message = null;
    req.session.messageType = null;
    res.redirect('/');
});

// login form
router.get('/login', (req, res) => {
    let db = req.app.db;

    db.users.count({}, (err, userCount) => {
        if(err){
            // if there are no users set the "needsSetup" session
            req.session.needsSetup = true;
            res.redirect('/setup');
        }
        // we check for a user. If one exists, redirect to login form otherwise setup
        if(userCount > 0){
            // set needsSetup to false as a user exists
            req.session.needsSetup = false;
            res.render('login', {
                title: 'Login',
                referringUrl: req.header('Referer'),
                config: common.getConfig(),
                message: common.clearSessionValue(req.session, 'message'),
                messageType: common.clearSessionValue(req.session, 'messageType'),
                helpers: req.handlebars.helpers,
                showFooter: 'showFooter'
            });
        }else{
            // if there are no users set the "needsSetup" session
            req.session.needsSetup = true;
            res.redirect('/setup');
        }
    });
});

// setup form is shown when there are no users setup in the DB
router.get('/setup', (req, res) => {
    let db = req.app.db;

    db.users.count({}, (err, userCount) => {
        if(err){
            console.error(colors.red('Error getting users for setup', err));
        }
        // dont allow the user to "re-setup" if a user exists.
        // set needsSetup to false as a user exists
        req.session.needsSetup = false;
        if(userCount === 0){
            req.session.needsSetup = true;
            res.render('setup', {
                title: 'Setup',
                config: common.getConfig(),
                helpers: req.handlebars.helpers,
                message: common.clearSessionValue(req.session, 'message'),
                messageType: common.clearSessionValue(req.session, 'messageType'),
                showFooter: 'showFooter'
            });
        }else{
            res.redirect('/login');
        }
    });
});

// login the user and check the password
router.post('/login_action', (req, res) => {
    let db = req.app.db;
    let bcrypt = req.bcrypt;

    db.users.findOne({userEmail: req.body.email}, (err, user) => {
        if(err){
            req.session.message = 'Cannot find user.';
            req.session.messageType = 'danger';
            res.redirect('/login');
            return;
        }

        // check if user exists with that email
        if(user === undefined || user === null){
            req.session.message = 'A user with that email does not exist.';
            req.session.messageType = 'danger';
            res.redirect('/login');
        }else{
            // we have a user under that email so we compare the password
            if(bcrypt.compareSync(req.body.password, user.userPassword) === true){
                req.session.user = req.body.email;
                req.session.usersName = user.usersName;
                req.session.userId = user._id.toString();
                req.session.isAdmin = user.isAdmin;
                res.redirect('/admin');
            }else{
                // password is not correct
                req.session.message = 'Access denied. Check password and try again.';
                req.session.messageType = 'danger';
                res.redirect('/login');
            }
        }
    });
});

// insert a customer
router.post('/customer/create', (req, res) => {
    const db = req.app.db;
    const bcrypt = req.bcrypt;

    let doc = {
        email: req.body.email,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        address1: req.body.address1,
        address2: req.body.address2,
        country: req.body.country,
        state: req.body.state,
        postcode: req.body.postcode,
        phone: req.body.phone,
        password: bcrypt.hashSync(req.body.password),
        created: new Date()
    };

    // check for existing customer
    db.customers.findOne({email: req.body.email}, (err, customer) => {
        if(customer){
            res.status(404).json({
                err: 'A customer already exists with that email address'
            });
            return;
        }
        // email is ok to be used.
        db.customers.insertOne(doc, (err, newCustomer) => {
            if(err){
                if(newCustomer){
                    console.error(colors.red('Failed to insert customer: ' + err));
                    res.status(400).json({
                        err: 'A customer already exists with that email address'
                    });
                    return;
                }
                console.error(colors.red('Failed to insert customer: ' + err));
                res.status(400).json({
                    err: 'Customer creation failed.'
                });
                return;
            }

            // Customer creation successful
            req.session.customer = newCustomer.ops[0];
            res.status(200).json({
                message: 'Successfully logged in',
                customer: newCustomer
            });
        });
    });
});

// login the customer and check the password
router.post('/customer/login_action', (req, res) => {
    let db = req.app.db;
    let bcrypt = req.bcrypt;

    db.customers.findOne({email: req.body.loginEmail}, (err, customer) => {
        if(err){
            // An error accurred
            return res.status(400).json({
                err: 'Access denied. Check password and try again.'
            });
        }

        // check if customer exists with that email
        if(customer === undefined || customer === null){
            return res.status(400).json({
                err: 'A customer with that email does not exist.'
            });
        }
        // we have a customer under that email so we compare the password
        if(bcrypt.compareSync(req.body.loginPassword, customer.password) === false){
            // password is not correct
            return res.status(400).json({
                err: 'Access denied. Check password and try again.'
            });
        }

        // Customer login successful
        req.session.customer = customer;
        return res.status(200).json({
            message: 'Successfully logged in',
            customer: customer
        });
    });
});

// customer forgotten password
router.get('/customer/forgotten', (req, res) => {
    res.render('forgotten', {
        title: 'Forgotten',
        route: 'customer',
        forgotType: 'customer',
        config: common.getConfig(),
        helpers: req.handlebars.helpers,
        message: common.clearSessionValue(req.session, 'message'),
        messageType: common.clearSessionValue(req.session, 'messageType'),
        showFooter: 'showFooter'
    });
});

// forgotten password
router.post('/customer/forgotten_action', (req, res) => {
    const db = req.app.db;
    const config = common.getConfig();
    let passwordToken = randtoken.generate(30);

    // find the user
    db.customers.findOne({email: req.body.email}, (err, customer) => {
        // if we have a customer, set a token, expiry and email it
        if(customer){
            let tokenExpiry = Date.now() + 3600000;
            db.customers.update({email: req.body.email}, {$set: {resetToken: passwordToken, resetTokenExpiry: tokenExpiry}}, {multi: false}, (err, numReplaced) => {
                // send forgotten password email
                let mailOpts = {
                    to: req.body.email,
                    subject: 'Forgotten password request',
                    body: `You are receiving this because you (or someone else) have requested the reset of the password for your user account.\n\n
                        Please click on the following link, or paste this into your browser to complete the process:\n\n
                        ${config.baseUrl}/customer/reset/${passwordToken}\n\n
                        If you did not request this, please ignore this email and your password will remain unchanged.\n`
                };

                // send the email with token to the user
                // TODO: Should fix this to properly handle result
                common.sendEmail(mailOpts.to, mailOpts.subject, mailOpts.body);
                req.session.message = 'An email has been sent to ' + req.body.email + ' with further instructions';
                req.session.message_type = 'success';
                return res.redirect('/customer/forgotten');
            });
        }else{
            req.session.message = 'Account does not exist';
            res.redirect('/customer/forgotten');
        }
    });
});

// reset password form
router.get('/customer/reset/:token', (req, res) => {
    const db = req.app.db;

    // Find the customer using the token
    db.customers.findOne({resetToken: req.params.token, resetTokenExpiry: {$gt: Date.now()}}, (err, customer) => {
        if(!customer){
            req.session.message = 'Password reset token is invalid or has expired';
            req.session.message_type = 'danger';
            res.redirect('/forgot');
            return;
        }

        // show the password reset form
        res.render('reset', {
            title: 'Reset password',
            token: req.params.token,
            route: 'customer',
            config: common.getConfig(),
            message: common.clearSessionValue(req.session, 'message'),
            message_type: common.clearSessionValue(req.session, 'message_type'),
            show_footer: 'show_footer',
            helpers: req.handlebars.helpers
        });
    });
});

// reset password action
router.post('/customer/reset/:token', (req, res) => {
    const db = req.app.db;
    let bcrypt = req.bcrypt;

    // get the customer
    db.customers.findOne({resetToken: req.params.token, resetTokenExpiry: {$gt: Date.now()}}, (err, customer) => {
        if(!customer){
            req.session.message = 'Password reset token is invalid or has expired';
            req.session.message_type = 'danger';
            return res.redirect('/forgot');
        }

        // update the password and remove the token
        let newPassword = bcrypt.hashSync(req.body.password);
        db.customers.update({email: customer.email}, {$set: {password: newPassword, resetToken: undefined, resetTokenExpiry: undefined}}, {multi: false}, (err, numReplaced) => {
            let mailOpts = {
                to: customer.email,
                subject: 'Password successfully reset',
                body: 'This is a confirmation that the password for your account ' + customer.email + ' has just been changed successfully.\n'
            };

            // TODO: Should fix this to properly handle result
            common.sendEmail(mailOpts.to, mailOpts.subject, mailOpts.body);
            req.session.message = 'Password successfully updated';
            req.session.message_type = 'success';
            return res.redirect('/pay');
        });
        return'';
    });
});

// logout the customer
router.post('/customer/logout', (req, res) => {
    req.session.customer = null;
    res.status(200).json({});
});

// search products
router.get('/search/:searchTerm/:pageNum?', (req, res) => {
    let db = req.app.db;
    let searchTerm = req.params.searchTerm;
    let productsIndex = req.app.productsIndex;
    let config = common.getConfig();
    let numberProducts = config.productsPerPage ? config.productsPerPage : 6;

    let lunrIdArray = [];
    productsIndex.search(searchTerm).forEach((id) => {
        lunrIdArray.push(common.getId(id.ref));
    });

    let pageNum = 1;
    if(req.params.pageNum){
        pageNum = req.params.pageNum;
    }

    Promise.all([
        common.getData(req, pageNum, {_id: {$in: lunrIdArray}}),
        common.getMenu(db)
    ])
    .then(([results, menu]) => {
        res.render(`${config.themeViews}index`, {
            title: 'Results',
            results: results.data,
            filtered: true,
            session: req.session,
            metaDescription: common.getConfig().cartTitle + ' - Search term: ' + searchTerm,
            searchTerm: searchTerm,
            pageCloseBtn: common.showCartCloseBtn('search'),
            message: common.clearSessionValue(req.session, 'message'),
            messageType: common.clearSessionValue(req.session, 'messageType'),
            productsPerPage: numberProducts,
            totalProductCount: results.totalProducts,
            pageNum: pageNum,
            paginateUrl: 'search',
            config: config,
            menu: common.sortMenu(menu),
            helpers: req.handlebars.helpers,
            showFooter: 'showFooter'
        });
    })
    .catch((err) => {
        console.error(colors.red('Error searching for products', err));
    });
});

// search products
router.get('/category/:cat/:pageNum?', (req, res) => {
    let db = req.app.db;
    let searchTerm = req.params.cat;
    let productsIndex = req.app.productsIndex;
    let config = common.getConfig();
    let numberProducts = config.productsPerPage ? config.productsPerPage : 6;

    let lunrIdArray = [];
    productsIndex.search(searchTerm).forEach((id) => {
        lunrIdArray.push(common.getId(id.ref));
    });

    let pageNum = 1;
    if(req.params.pageNum){
        pageNum = req.params.pageNum;
    }

    Promise.all([
        common.getData(req, pageNum, {_id: {$in: lunrIdArray}}),
        common.getMenu(db)
    ])
    .then(([results, menu]) => {
        const sortedMenu = common.sortMenu(menu);

        res.render(`${config.themeViews}index`, {
            title: 'Category',
            results: results.data,
            filtered: true,
            session: req.session,
            searchTerm: searchTerm,
            metaDescription: common.getConfig().cartTitle + ' - Category: ' + searchTerm,
            pageCloseBtn: common.showCartCloseBtn('category'),
            message: common.clearSessionValue(req.session, 'message'),
            messageType: common.clearSessionValue(req.session, 'messageType'),
            productsPerPage: numberProducts,
            totalProductCount: results.totalProducts,
            pageNum: pageNum,
            menuLink: _.find(sortedMenu.items, (obj) => { return obj.link === searchTerm; }),
            paginateUrl: 'category',
            config: config,
            menu: sortedMenu,
            helpers: req.handlebars.helpers,
            showFooter: 'showFooter'
        });
    })
    .catch((err) => {
        console.error(colors.red('Error getting products for category', err));
    });
});

// return sitemap
router.get('/sitemap.xml', (req, res, next) => {
    let sm = require('sitemap');
    let config = common.getConfig();

    common.addSitemapProducts(req, res, (err, products) => {
        if(err){
            console.error(colors.red('Error generating sitemap.xml', err));
        }
        let sitemap = sm.createSitemap(
            {
                hostname: config.baseUrl,
                cacheTime: 600000,
                urls: [
                    {url: '/', changefreq: 'weekly', priority: 1.0}
                ]
            });

        let currentUrls = sitemap.urls;
        let mergedUrls = currentUrls.concat(products);
        sitemap.urls = mergedUrls;
        // render the sitemap
        sitemap.toXML((err, xml) => {
            if(err){
                return res.status(500).end();
            }
            res.header('Content-Type', 'application/xml');
            res.send(xml);
            return true;
        });
    });
});

router.get('/page/:pageNum', (req, res, next) => {
    let db = req.app.db;
    let config = common.getConfig();
    let numberProducts = config.productsPerPage ? config.productsPerPage : 6;

    Promise.all([
        common.getData(req, req.params.pageNum),
        common.getMenu(db)
    ])
    .then(([results, menu]) => {
        res.render(`${config.themeViews}index`, {
            title: 'Shop',
            results: results.data,
            session: req.session,
            message: common.clearSessionValue(req.session, 'message'),
            messageType: common.clearSessionValue(req.session, 'messageType'),
            metaDescription: common.getConfig().cartTitle + ' - Products page: ' + req.params.pageNum,
            pageCloseBtn: common.showCartCloseBtn('page'),
            config: common.getConfig(),
            productsPerPage: numberProducts,
            totalProductCount: results.totalProducts,
            pageNum: req.params.pageNum,
            paginateUrl: 'page',
            helpers: req.handlebars.helpers,
            showFooter: 'showFooter',
            menu: common.sortMenu(menu)
        });
    })
    .catch((err) => {
        console.error(colors.red('Error getting products for page', err));
    });
});

// The main entry point of the shop
router.get('/:page?', (req, res, next) => {
    let db = req.app.db;
    let config = common.getConfig();
    let numberProducts = config.productsPerPage ? config.productsPerPage : 6;

    // if no page is specified, just render page 1 of the cart
    if(!req.params.page){
        Promise.all([
            common.getData(req, 1, {}),
            common.getMenu(db)
        ])
        .then(([results, menu]) => {
            res.render(`${config.themeViews}index`, {
                title: `${config.cartTitle} - Shop`,
                theme: config.theme,
                results: results.data,
                session: req.session,
                message: common.clearSessionValue(req.session, 'message'),
                messageType: common.clearSessionValue(req.session, 'messageType'),
                pageCloseBtn: common.showCartCloseBtn('page'),
                config: common.getConfig(),
                productsPerPage: numberProducts,
                totalProductCount: results.totalProducts,
                pageNum: 1,
                paginateUrl: 'page',
                helpers: req.handlebars.helpers,
                showFooter: 'showFooter',
                menu: common.sortMenu(menu)
            });
        })
        .catch((err) => {
            console.error(colors.red('Error getting products for page', err));
        });
    }else{
        if(req.params.page === 'admin'){
            next();
            return;
        }
        // lets look for a page
        db.pages.findOne({pageSlug: req.params.page, pageEnabled: 'true'}, async (err, page) => {
            if(err){
                console.error(colors.red('Error getting page', err));
            }
            // if we have a page lets render it, else throw 404
            if(page){
                res.render(`${config.themeViews}page`, {
                    title: page.pageName,
                    page: page,
                    session: req.session,
                    message: common.clearSessionValue(req.session, 'message'),
                    messageType: common.clearSessionValue(req.session, 'messageType'),
                    pageCloseBtn: common.showCartCloseBtn('page'),
                    config: common.getConfig(),
                    metaDescription: common.getConfig().cartTitle + ' - ' + page,
                    helpers: req.handlebars.helpers,
                    showFooter: 'showFooter',
                    menu: common.sortMenu(await common.getMenu(db))
                });
            }else{
                res.status(404).render('error', {
                    title: '404 Error - Page not found',
                    config: common.getConfig(),
                    message: '404 Error - Page not found',
                    helpers: req.handlebars.helpers,
                    showFooter: 'showFooter',
                    menu: common.sortMenu(await common.getMenu(db))
                });
            }
        });
    }
});

module.exports = router;
