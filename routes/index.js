const express = require('express');
const router = express.Router();
const colors = require('colors');
const _ = require('lodash');
const common = require('./common');

router.get('/payment/:orderId', (req, res, next) => {
    var db = req.app.db;
    var config = common.getConfig();

    // render the payment complete message
    db.orders.findOne({_id: common.getId(req.params.orderId)}, (err, result) => {
        if(err){
            console.info(err.stack);
        }
        res.render(config.themeViews + 'payment_complete', {
            title: 'Payment complete',
            config: common.getConfig(),
            session: req.session,
            pageCloseBtn: common.showCartCloseBtn('payment'),
            result: result,
            message: common.clearSessionValue(req.session, 'message'),
            messageType: common.clearSessionValue(req.session, 'messageType'),
            helpers: req.handlebars.helpers,
            showFooter: 'showFooter',
            menu: common.getMenu()
        });
    });
});

router.get('/checkout', (req, res, next) => {
    var config = common.getConfig();

    // if there is no items in the cart then render a failure
    if(!req.session.cart){
        req.session.message = 'The are no items in your cart. Please add some items before checking out';
        req.session.messageType = 'danger';
        res.redirect('/');
        return;
    }

    // render the checkout
    res.render(config.themeViews + 'checkout', {
        title: 'Checkout',
        config: common.getConfig(),
        session: req.session,
        pageCloseBtn: common.showCartCloseBtn('checkout'),
        checkout: 'hidden',
        page: 'checkout',
        message: common.clearSessionValue(req.session, 'message'),
        messageType: common.clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers,
        showFooter: 'showFooter',
        menu: common.getMenu()
    });
});

router.get('/pay', (req, res, next) => {
    var config = common.getConfig();

    // if there is no items in the cart then render a failure
    if(!req.session.cart){
        req.session.message = 'The are no items in your cart. Please add some items before checking out';
        req.session.messageType = 'danger';
        res.redirect('/checkout');
        return;
    }

    // render the payment page
    res.render(config.themeViews + 'pay', {
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
        showFooter: 'showFooter',
        menu: common.getMenu()
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
    var db = req.app.db;
    var config = common.getConfig();

    db.products.findOne({$or: [{_id: common.getId(req.params.id)}, {productPermalink: req.params.id}]}, function (err, result){
        // render 404 if page is not published
        if(err){
            res.render('error', {message: '404 - Page not found', helpers: req.handlebars.helpers});
        }
        if(err || result == null || result.productPublished === 'false'){
            res.render('error', {message: '404 - Page not found', helpers: req.handlebars.helper});
        }else{
            var productOptions = {};
            if(result.productOptions){
                productOptions = JSON.parse(result.productOptions);
            }

            // show the view
            common.getImages(result._id, req, res, function (images){
                res.render(config.themeViews + 'product', {
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
                    menu: common.getMenu()
                });
            });
        }
    });
});

// logout
router.get('/logout', function (req, res){
    req.session.user = null;
    req.session.message = null;
    req.session.messageType = null;
    res.redirect('/');
});

// login form
router.get('/login', function (req, res){
    var db = req.app.db;

    db.users.count({}, function(err, userCount){
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
router.get('/setup', function (req, res){
    var db = req.app.db;

    db.users.count({}, function (err, userCount){
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
            return;
        }
    });
});

// login the user and check the password
router.post('/login_action', function (req, res){
    var db = req.app.db;
    var bcrypt = req.bcrypt;

    db.users.findOne({userEmail: req.body.email}, function (err, user){
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
                return;
            }
        }
    });
});

// search products
router.get('/search/:searchTerm/:pageNum?', function (req, res){
    var searchTerm = req.params.searchTerm;
    var productsIndex = req.app.productsIndex;
    var config = common.getConfig();
    var numberProducts = config.productsPerPage ? config.productsPerPage : 6;

    var lunrIdArray = [];
    productsIndex.search(searchTerm).forEach(function(id){
        if(config.databaseType !== 'embedded'){
            lunrIdArray.push(common.getId(id.ref));
        }else{
            lunrIdArray.push(id.ref);
        }
    });

    var pageNum = 1;
    if(req.params.pageNum){
        pageNum = req.params.pageNum;
    }

    // we search on the lunr indexes
    getData(req, pageNum, {_id: {$in: lunrIdArray}}, function (err, results){
        if(err){
            console.error(colors.red('Error searching for products', err));
        }

        res.render(config.themeViews + 'index', {
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
            menu: common.getMenu(),
            helpers: req.handlebars.helpers,
            showFooter: 'showFooter'
        });
    });
});

// search products
router.get('/category/:cat/:pageNum?', function (req, res){
    var searchTerm = req.params.cat;
    var productsIndex = req.app.productsIndex;
    var config = common.getConfig();
    var numberProducts = config.productsPerPage ? config.productsPerPage : 6;

    var lunrIdArray = [];
    productsIndex.search(searchTerm).forEach(function(id){
        if(config.databaseType !== 'embedded'){
            lunrIdArray.push(common.getId(id.ref));
        }else{
            lunrIdArray.push(id.ref);
        }
    });

    var menuLink = _.find(common.getMenu().items, function(obj){ return obj.link === searchTerm; });

    var pageNum = 1;
    if(req.params.pageNum){
        pageNum = req.params.pageNum;
    }

    // we search on the lunr indexes
    getData(req, pageNum, {_id: {$in: lunrIdArray}}, function (err, results){
        if(err){
            console.error(colors.red('Error getting products for category', err));
        }

        res.render(config.themeViews + 'index', {
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
            menuLink: menuLink,
            paginateUrl: 'category',
            config: config,
            menu: common.getMenu(),
            helpers: req.handlebars.helpers,
            showFooter: 'showFooter'
        });
    });
});

// return sitemap
router.get('/sitemap.xml', function (req, res, next){
    var sm = require('sitemap');
    var config = common.getConfig();

    common.addSitemapProducts(req, res, function (err, products){
        if(err){
            console.error(colors.red('Error generating sitemap.xml', err));
        }
        var sitemap = sm.createSitemap(
            {
                hostname: config.baseUrl,
                cacheTime: 600000,
                urls: [
                    {url: '/', changefreq: 'weekly', priority: 1.0}
                ]
            });

        var currentUrls = sitemap.urls;
        var mergedUrls = currentUrls.concat(products);
        sitemap.urls = mergedUrls;
        // render the sitemap
        sitemap.toXML(function(err, xml){
            if(err){
                return res.status(500).end();
            }
            res.header('Content-Type', 'application/xml');
            res.send(xml);
            return true;
        });
    });
});

router.get('/page/:pageNum', function (req, res, next){
    var config = common.getConfig();
    var numberProducts = config.productsPerPage ? config.productsPerPage : 6;

    getData(req, req.params.pageNum, {}, function (err, results){
        if(err){
            console.error(colors.red('Error getting products for page', err));
        }

        res.render(config.themeViews + 'index', {
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
            menu: common.getMenu()
        });
    });
});

router.get('/:page?', function (req, res, next){
    var db = req.app.db;
    var config = common.getConfig();
    var numberProducts = config.productsPerPage ? config.productsPerPage : 6;

    // if no page is specified, just render page 1 of the cart
    if(!req.params.page){
        getData(req, 1, {}, function (err, results){
            if(err){
                console.error(colors.red('Error getting products for page', err));
            }

            res.render(config.themeViews + 'index', {
                title: 'Shop',
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
                menu: common.getMenu()
            });
        });
    }else{
        if(req.params.page === 'admin'){
            next();
            return;
        }
        // lets look for a page
        db.pages.findOne({pageSlug: req.params.page, pageEnabled: 'true'}, function (err, page){
            if(err){
                console.error(colors.red('Error getting page', err));
            }
            // if we have a page lets render it, else throw 404
            if(page){
                res.render(config.themeViews + 'page', {
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
                    menu: common.getMenu()
                });
            }else{
                res.status(404).render('error', {
                    title: '404 Error - Page not found',
                    config: common.getConfig(),
                    message: '404 Error - Page not found',
                    helpers: req.handlebars.helpers,
                    showFooter: 'showFooter',
                    menu: common.getMenu()
                }
                );
            }
        });
    }
});

var getData = function (req, page, query, cb){
    var db = req.app.db;
    var config = common.getConfig();
    var numberProducts = config.productsPerPage ? config.productsPerPage : 6;

    var skip = 0;
    if(page > 1){
        skip = (page - 1) * numberProducts;
    }

    query['productPublished'] = 'true';

    db.products.count(query, function (err, totalProducts){
        if(err){
            console.error(colors.red('Error getting total product count', err));
        }

        if(config.databaseType === 'embedded'){
            db.products.find(query).skip(skip).limit(parseInt(numberProducts)).exec(function (err, results){
                if(err){
                    cb('Error retrieving products', null);
                }else{
                    cb(null, {data: results, totalProducts: totalProducts});
                }
            });
        }else{
            db.products.find(query).skip(skip).limit(parseInt(numberProducts)).toArray(function (err, results){
                if(err){
                    cb('Error retrieving products', null);
                }else{
                    cb(null, {data: results, totalProducts: totalProducts});
                }
            });
        }
    });
};

module.exports = router;
