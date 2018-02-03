const express = require('express');
const router = express.Router();
const colors = require('colors');
const async = require('async');
const _ = require('lodash');
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

// Updates a single product quantity
router.post('/product/updatecart', (req, res, next) => {
    const db = req.app.db;
    let cartItems = JSON.parse(req.body.items);
    let hasError = false;

    async.eachSeries(cartItems, (cartItem, callback) => {
        let productQuantity = cartItem.itemQuantity ? cartItem.itemQuantity : 1;
        if(cartItem.itemQuantity === 0){
            // quantity equals zero so we remove the item
            req.session.cart.splice(cartItem.cartIndex, 1);
            callback(null);
        }else{
            db.products.findOne({_id: common.getId(cartItem.productId)}, (err, product) => {
                if(err){
                    console.error(colors.red('Error updating cart', err));
                }
                if(product){
                    let productPrice = parseFloat(product.productPrice).toFixed(2);
                    if(req.session.cart[cartItem.cartIndex]){
                        req.session.cart[cartItem.cartIndex].quantity = productQuantity;
                        req.session.cart[cartItem.cartIndex].totalItemPrice = productPrice * productQuantity;
                        callback(null);
                    }
                }else{
                    hasError = true;
                    callback(null);
                }
            });
        }
    }, () => {
        // update total cart amount
        common.updateTotalCartAmount(req, res);

        // show response
        if(hasError === false){
            res.status(200).json({message: 'Cart successfully updated', totalCartItems: Object.keys(req.session.cart).length});
        }else{
            res.status(400).json({message: 'There was an error updating the cart', totalCartItems: Object.keys(req.session.cart).length});
        }
    });
});

// Remove single product from cart
router.post('/product/removefromcart', (req, res, next) => {
    // remove item from cart
    async.each(req.session.cart, (item, callback) => {
        if(item){
            if(item.productId === req.body.cart_index){
                req.session.cart = _.pull(req.session.cart, item);
            }
        }
        callback();
    }, () => {
        // update total cart amount
        common.updateTotalCartAmount(req, res);
        res.status(200).json({message: 'Product successfully removed', totalCartItems: Object.keys(req.session.cart).length});
    });
});

// Totally empty the cart
router.post('/product/emptycart', (req, res, next) => {
    delete req.session.cart;
    delete req.session.orderId;

    // update total cart amount
    common.updateTotalCartAmount(req, res);
    res.status(200).json({message: 'Cart successfully emptied', totalCartItems: 0});
});

// Add item to cart
router.post('/product/addtocart', (req, res, next) => {
    const db = req.app.db;
    let productQuantity = req.body.productQuantity ? parseInt(req.body.productQuantity) : 1;

    // setup cart object if it doesn't exist
    if(!req.session.cart){
        req.session.cart = [];
    }

    // Get the item from the DB
    db.products.findOne({_id: common.getId(req.body.productId)}, (err, product) => {
        if(err){
            console.error(colors.red('Error adding to cart', err));
        }

        // We item is found, add it to the cart
        if(product){
            let productPrice = parseFloat(product.productPrice).toFixed(2);

            // Doc used to test if existing in the cart with the options. If not found, we add new.
            let options = {};
            if(req.body.productOptions){
                options = JSON.parse(req.body.productOptions);
            }
            let findDoc = {
                productId: req.body.productId,
                options: options
            };

            // if exists we add to the existing value
            let cartIndex = _.findIndex(req.session.cart, findDoc);
            if(cartIndex > -1){
                req.session.cart[cartIndex].quantity = parseInt(req.session.cart[cartIndex].quantity) + productQuantity;
                req.session.cart[cartIndex].totalItemPrice = productPrice * parseInt(req.session.cart[cartIndex].quantity);
            }else{
                // Doesnt exist so we add to the cart session
                req.session.cartTotalItems = req.session.cartTotalItems + productQuantity;

                // new product deets
                let productObj = {};
                productObj.productId = req.body.productId;
                productObj.title = product.productTitle;
                productObj.quantity = productQuantity;
                productObj.totalItemPrice = productPrice * productQuantity;
                productObj.options = options;
                productObj.productImage = product.productImage;
                if(product.productPermalink){
                    productObj.link = product.productPermalink;
                }else{
                    productObj.link = product._id;
                }

                // merge into the current cart
                req.session.cart.push(productObj);
            }

            // update total cart amount
            common.updateTotalCartAmount(req, res);

            // update how many products in the shopping cart
            req.session.cartTotalItems = Object.keys(req.session.cart).length;
            res.status(200).json({message: 'Cart successfully updated', totalCartItems: Object.keys(req.session.cart).length});
        }else{
            res.status(400).json({message: 'Error updating cart. Please try again.'});
        }
    });
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
