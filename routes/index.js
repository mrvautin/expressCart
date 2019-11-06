const express = require('express');
const router = express.Router();
const colors = require('colors');
const async = require('async');
const _ = require('lodash');
const {
    getId,
    hooker,
    showCartCloseBtn,
    clearSessionValue,
    sortMenu,
    getMenu,
    getPaymentConfig,
    getImages,
    updateTotalCartAmount,
    updateSubscriptionCheck,
    getData,
    addSitemapProducts
} = require('../lib/common');

// These is the customer facing routes
router.get('/payment/:orderId', async (req, res, next) => {
    const db = req.app.db;
    const config = req.app.config;

    // Get the order
    const order = await db.orders.findOne({ _id: getId(req.params.orderId) });
    if(!order){
        res.render('error', { title: 'Not found', message: 'Order not found', helpers: req.handlebars.helpers, config });
        return;
    }

    // If stock management is turned on payment approved update stock level
    if(config.trackStock && req.session.paymentApproved){
        order.orderProducts.forEach(async (product) => {
            const dbProduct = await db.products.findOne({ _id: getId(product.productId) });
            let newStockLevel = dbProduct.productStock - product.quantity;
            if(newStockLevel < 1){
                newStockLevel = 0;
            }

            // Update product stock
            await db.products.updateOne({
                _id: getId(product.productId)
            }, {
                $set: {
                    productStock: newStockLevel
                }
            }, { multi: false });
        });
    }

    // If hooks are configured, send hook
    if(config.orderHook){
        await hooker(order);
    };

    res.render(`${config.themeViews}payment_complete`, {
        title: 'Payment complete',
        config: req.app.config,
        session: req.session,
        pageCloseBtn: showCartCloseBtn('payment'),
        result: order,
        message: clearSessionValue(req.session, 'message'),
        messageType: clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers,
        showFooter: 'showFooter',
        menu: sortMenu(await getMenu(db))
    });
});

router.get('/emptycart', async (req, res, next) => {
    emptyCart(req, res, '');
});

router.get('/checkout', async (req, res, next) => {
    const config = req.app.config;

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
        config: req.app.config,
        session: req.session,
        pageCloseBtn: showCartCloseBtn('checkout'),
        checkout: 'hidden',
        page: 'checkout',
        message: clearSessionValue(req.session, 'message'),
        messageType: clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers,
        showFooter: 'showFooter'
    });
});

router.get('/pay', async (req, res, next) => {
    const config = req.app.config;

    // if there is no items in the cart then render a failure
    if(!req.session.cart){
        req.session.message = 'The are no items in your cart. Please add some items before checking out';
        req.session.messageType = 'danger';
        res.redirect('/checkout');
        return;
    }

    let paymentType = '';
    if(req.session.cartSubscription){
        paymentType = '_subscription';
    }

    // render the payment page
    res.render(`${config.themeViews}pay`, {
        title: 'Pay',
        config: req.app.config,
        paymentConfig: getPaymentConfig(),
        pageCloseBtn: showCartCloseBtn('pay'),
        session: req.session,
        paymentPage: true,
        paymentType,
        page: 'pay',
        message: clearSessionValue(req.session, 'message'),
        messageType: clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers,
        showFooter: 'showFooter'
    });
});

router.get('/cartPartial', (req, res) => {
    const config = req.app.config;

    res.render(`${config.themeViews}cart`, {
        pageCloseBtn: showCartCloseBtn(req.query.path),
        page: req.query.path,
        layout: false,
        helpers: req.handlebars.helpers,
        config: req.app.config,
        session: req.session
    });
});

// show an individual product
router.get('/product/:id', async (req, res) => {
    const db = req.app.db;
    const config = req.app.config;

    const product = await db.products.findOne({ $or: [{ _id: getId(req.params.id) }, { productPermalink: req.params.id }] });
    if(!product){
        res.render('error', { title: 'Not found', message: 'Order not found', helpers: req.handlebars.helpers, config });
        return;
    }
    if(product.productPublished === false){
        res.render('error', { title: 'Not found', message: 'Product not found', helpers: req.handlebars.helpers, config });
        return;
    }
    const productOptions = product.productOptions;

    // If JSON query param return json instead
    if(req.query.json === 'true'){
        res.status(200).json(product);
        return;
    }

    // show the view
    const images = await getImages(product._id, req, res);

    res.render(`${config.themeViews}product`, {
        title: product.productTitle,
        result: product,
        productOptions: productOptions,
        images: images,
        productDescription: product.productDescription,
        metaDescription: config.cartTitle + ' - ' + product.productTitle,
        pageCloseBtn: showCartCloseBtn('product'),
        config: config,
        session: req.session,
        pageUrl: config.baseUrl + req.originalUrl,
        message: clearSessionValue(req.session, 'message'),
        messageType: clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers,
        showFooter: 'showFooter',
        menu: sortMenu(await getMenu(db))
    });
});

// Updates a single product quantity
router.post('/product/updatecart', (req, res, next) => {
    const db = req.app.db;
    const config = req.app.config;
    const cartItems = JSON.parse(req.body.items);
    let hasError = false;
    let stockError = false;

    async.eachSeries(cartItems, async (cartItem, callback) => {
        const productQuantity = cartItem.itemQuantity ? cartItem.itemQuantity : 1;
        if(cartItem.itemQuantity === 0){
            // quantity equals zero so we remove the item
            req.session.cart.splice(cartItem.cartIndex, 1);
            callback(null);
        }else{
            const product = await db.products.findOne({ _id: getId(cartItem.productId) });
            if(product){
                // If stock management on check there is sufficient stock for this product
                if(config.trackStock){
                    if(productQuantity > product.productStock){
                        hasError = true;
                        stockError = true;
                        callback(null);
                        return;
                    }
                }

                const productPrice = parseFloat(product.productPrice).toFixed(2);
                if(req.session.cart[cartItem.cartIndex]){
                    req.session.cart[cartItem.cartIndex].quantity = productQuantity;
                    req.session.cart[cartItem.cartIndex].totalItemPrice = productPrice * productQuantity;
                    callback(null);
                }
            }else{
                hasError = true;
                callback(null);
            }
        }
    }, async () => {
        // update total cart amount
        updateTotalCartAmount(req, res);

        // Update checking cart for subscription
        updateSubscriptionCheck(req, res);

        // Update cart to the DB
        await db.cart.updateOne({ sessionId: req.session.id }, {
            $set: { cart: req.session.cart }
        });

        // show response
        if(hasError === false){
            res.status(200).json({ message: 'Cart successfully updated', totalCartItems: Object.keys(req.session.cart).length });
        }else{
            if(stockError){
                res.status(400).json({ message: 'There is insufficient stock of this product.', totalCartItems: Object.keys(req.session.cart).length });
            }else{
                res.status(400).json({ message: 'There was an error updating the cart', totalCartItems: Object.keys(req.session.cart).length });
            }
        }
    });
});

// Remove single product from cart
router.post('/product/removefromcart', async (req, res, next) => {
    const db = req.app.db;
    let itemRemoved = false;

    // remove item from cart
    req.session.cart.forEach((item) => {
        if(item){
            if(item.productId === req.body.cartId){
                itemRemoved = true;
                req.session.cart = _.pull(req.session.cart, item);
            }
        }
    });

    // Update cart in DB
    await db.cart.updateOne({ sessionId: req.session.id }, {
        $set: { cart: req.session.cart }
    });
    // update total cart amount
    updateTotalCartAmount(req, res);

    // Update checking cart for subscription
    updateSubscriptionCheck(req, res);

    if(itemRemoved === false){
        return res.status(400).json({ message: 'Product not found in cart' });
    }
    return res.status(200).json({ message: 'Product successfully removed', totalCartItems: Object.keys(req.session.cart).length });
});

// Totally empty the cart
router.post('/product/emptycart', async (req, res, next) => {
    emptyCart(req, res, 'json');
});

const emptyCart = async (req, res, type) => {
    const db = req.app.db;

    // Remove from session
    delete req.session.cart;
    delete req.session.orderId;

    // Remove cart from DB
    await db.cart.deleteOne({ sessionId: req.session.id });

    // update total cart amount
    updateTotalCartAmount(req, res);

    // Update checking cart for subscription
    updateSubscriptionCheck(req, res);

    // If POST, return JSON else redirect nome
    if(type === 'json'){
        res.status(200).json({ message: 'Cart successfully emptied', totalCartItems: 0 });
        return;
    }

    req.session.message = 'Cart successfully emptied.';
    req.session.messageType = 'success';
    res.redirect('/');
};

// Add item to cart
router.post('/product/addtocart', async (req, res, next) => {
    const db = req.app.db;
    const config = req.app.config;
    let productQuantity = req.body.productQuantity ? parseInt(req.body.productQuantity) : 1;
    const productComment = req.body.productComment ? req.body.productComment : null;

    // Don't allow negative quantity
    if(productQuantity < 0){
        productQuantity = 1;
    }

    // setup cart object if it doesn't exist
    if(!req.session.cart){
        req.session.cart = [];
    }

    // Get the product from the DB
    const product = await db.products.findOne({ _id: getId(req.body.productId) });
    // No product found
    if(!product){
        return res.status(400).json({ message: 'Error updating cart. Please try again.' });
    }

    // If cart already has a subscription you cannot add anything else
    if(req.session.cartSubscription){
        return res.status(400).json({ message: 'Subscription already existing in cart. You cannot add more.' });
    }

    // If existing cart isn't empty check if product is a subscription
    if(req.session.cart.length !== 0){
        if(product.productSubscription){
            return res.status(400).json({ message: 'You cannot combine scubscription products with existing in your cart. Empty your cart and try again.' });
        }
    }

    // If stock management on check there is sufficient stock for this product
    if(config.trackStock && product.productStock){
        const stockHeld = await db.cart.aggregate(
            {
                $match: {
                    cart: { $elemMatch: { productId: product._id.toString() } }
                }
            },
            { $unwind: '$cart' },
            {
                $group: {
                    _id: '$cart.productId',
                    sumHeld: { $sum: '$cart.quantity' }
                }
            },
            {
                $project: {
                    sumHeld: 1
                }
            }
        ).toArray();

        // If there is stock
        if(stockHeld.length > 0){
            const totalHeld = _.find(stockHeld, { _id: product._id.toString() }).sumHeld;
            const netStock = product.productStock - totalHeld;

            // Check there is sufficient stock
            if(productQuantity > netStock){
                return res.status(400).json({ message: 'There is insufficient stock of this product.' });
            }
        }
    }

    const productPrice = parseFloat(product.productPrice).toFixed(2);

    // Doc used to test if existing in the cart with the options. If not found, we add new.
    let options = {};
    if(req.body.productOptions){
        try{
            if(typeof req.body.productOptions === 'object'){
                options = req.body.productOptions;
            }else{
                options = JSON.parse(req.body.productOptions);
            }
        }catch(ex){}
    }
    const findDoc = {
        productId: req.body.productId,
        options: options
    };

    // if exists we add to the existing value
    const cartIndex = _.findIndex(req.session.cart, findDoc);
    let cartQuantity = 0;
    if(cartIndex > -1){
        cartQuantity = parseInt(req.session.cart[cartIndex].quantity) + productQuantity;
        req.session.cart[cartIndex].quantity = cartQuantity;
        req.session.cart[cartIndex].totalItemPrice = productPrice * parseInt(req.session.cart[cartIndex].quantity);
    }else{
        // Doesnt exist so we add to the cart session
        req.session.cartTotalItems = req.session.cartTotalItems + productQuantity;

        // Set the card quantity
        cartQuantity = productQuantity;

        // new product deets
        const productObj = {};
        productObj.productId = req.body.productId;
        productObj.title = product.productTitle;
        productObj.quantity = productQuantity;
        productObj.totalItemPrice = productPrice * productQuantity;
        productObj.options = options;
        productObj.productImage = product.productImage;
        productObj.productComment = productComment;
        productObj.productSubscription = product.productSubscription;
        if(product.productPermalink){
            productObj.link = product.productPermalink;
        }else{
            productObj.link = product._id;
        }

        // merge into the current cart
        req.session.cart.push(productObj);
    }

    // Update cart to the DB
    await db.cart.updateOne({ sessionId: req.session.id }, {
        $set: { cart: req.session.cart }
    }, { upsert: true });

    // update total cart amount
    updateTotalCartAmount(req, res);

    // Update checking cart for subscription
    updateSubscriptionCheck(req, res);

    if(product.productSubscription){
        req.session.cartSubscription = product.productSubscription;
    }

    // update how many products in the shopping cart
    req.session.cartTotalItems = req.session.cart.reduce((a, b) => +a + +b.quantity, 0);
    return res.status(200).json({ message: 'Cart successfully updated', totalCartItems: req.session.cartTotalItems });
});

// search products
router.get('/search/:searchTerm/:pageNum?', (req, res) => {
    const db = req.app.db;
    const searchTerm = req.params.searchTerm;
    const productsIndex = req.app.productsIndex;
    const config = req.app.config;
    const numberProducts = config.productsPerPage ? config.productsPerPage : 6;

    const lunrIdArray = [];
    productsIndex.search(searchTerm).forEach((id) => {
        lunrIdArray.push(getId(id.ref));
    });

    let pageNum = 1;
    if(req.params.pageNum){
        pageNum = req.params.pageNum;
    }

    Promise.all([
        getData(req, pageNum, { _id: { $in: lunrIdArray } }),
        getMenu(db)
    ])
        .then(([results, menu]) => {
            // If JSON query param return json instead
            if(req.query.json === 'true'){
                res.status(200).json(results.data);
                return;
            }

            res.render(`${config.themeViews}index`, {
                title: 'Results',
                results: results.data,
                filtered: true,
                session: req.session,
                metaDescription: req.app.config.cartTitle + ' - Search term: ' + searchTerm,
                searchTerm: searchTerm,
                pageCloseBtn: showCartCloseBtn('search'),
                message: clearSessionValue(req.session, 'message'),
                messageType: clearSessionValue(req.session, 'messageType'),
                productsPerPage: numberProducts,
                totalProductCount: results.totalProducts,
                pageNum: pageNum,
                paginateUrl: 'search',
                config: config,
                menu: sortMenu(menu),
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
    const db = req.app.db;
    const searchTerm = req.params.cat;
    const productsIndex = req.app.productsIndex;
    const config = req.app.config;
    const numberProducts = config.productsPerPage ? config.productsPerPage : 6;

    const lunrIdArray = [];
    productsIndex.search(searchTerm).forEach((id) => {
        lunrIdArray.push(getId(id.ref));
    });

    let pageNum = 1;
    if(req.params.pageNum){
        pageNum = req.params.pageNum;
    }

    Promise.all([
        getData(req, pageNum, { _id: { $in: lunrIdArray } }),
        getMenu(db)
    ])
        .then(([results, menu]) => {
            const sortedMenu = sortMenu(menu);

            // If JSON query param return json instead
            if(req.query.json === 'true'){
                res.status(200).json(results.data);
                return;
            }

            res.render(`${config.themeViews}index`, {
                title: 'Category',
                results: results.data,
                filtered: true,
                session: req.session,
                searchTerm: searchTerm,
                metaDescription: req.app.config.cartTitle + ' - Category: ' + searchTerm,
                pageCloseBtn: showCartCloseBtn('category'),
                message: clearSessionValue(req.session, 'message'),
                messageType: clearSessionValue(req.session, 'messageType'),
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

// Language setup in cookie
router.get('/lang/:locale', (req, res) => {
    res.cookie('locale', req.params.locale, { maxAge: 900000, httpOnly: true });
    res.redirect('back');
});

// return sitemap
router.get('/sitemap.xml', (req, res, next) => {
    const sm = require('sitemap');
    const config = req.app.config;

    addSitemapProducts(req, res, (err, products) => {
        if(err){
            console.error(colors.red('Error generating sitemap.xml', err));
        }
        const sitemap = sm.createSitemap(
            {
                hostname: config.baseUrl,
                cacheTime: 600000,
                urls: [
                    { url: '/', changefreq: 'weekly', priority: 1.0 }
                ]
            });

        const currentUrls = sitemap.urls;
        const mergedUrls = currentUrls.concat(products);
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
    const db = req.app.db;
    const config = req.app.config;
    const numberProducts = config.productsPerPage ? config.productsPerPage : 6;

    Promise.all([
        getData(req, req.params.pageNum),
        getMenu(db)
    ])
        .then(([results, menu]) => {
            // If JSON query param return json instead
            if(req.query.json === 'true'){
                res.status(200).json(results.data);
                return;
            }

            res.render(`${config.themeViews}index`, {
                title: 'Shop',
                results: results.data,
                session: req.session,
                message: clearSessionValue(req.session, 'message'),
                messageType: clearSessionValue(req.session, 'messageType'),
                metaDescription: req.app.config.cartTitle + ' - Products page: ' + req.params.pageNum,
                pageCloseBtn: showCartCloseBtn('page'),
                config: req.app.config,
                productsPerPage: numberProducts,
                totalProductCount: results.totalProducts,
                pageNum: req.params.pageNum,
                paginateUrl: 'page',
                helpers: req.handlebars.helpers,
                showFooter: 'showFooter',
                menu: sortMenu(menu)
            });
        })
        .catch((err) => {
            console.error(colors.red('Error getting products for page', err));
        });
});

// The main entry point of the shop
router.get('/:page?', async (req, res, next) => {
    const db = req.app.db;
    const config = req.app.config;
    const numberProducts = config.productsPerPage ? config.productsPerPage : 6;

    // if no page is specified, just render page 1 of the cart
    if(!req.params.page){
        Promise.all([
            getData(req, 1, {}),
            getMenu(db)
        ])
            .then(([results, menu]) => {
                // If JSON query param return json instead
                if(req.query.json === 'true'){
                    res.status(200).json(results.data);
                    return;
                }

                res.render(`${config.themeViews}index`, {
                    title: `${config.cartTitle} - Shop`,
                    theme: config.theme,
                    results: results.data,
                    session: req.session,
                    message: clearSessionValue(req.session, 'message'),
                    messageType: clearSessionValue(req.session, 'messageType'),
                    pageCloseBtn: showCartCloseBtn('page'),
                    config,
                    productsPerPage: numberProducts,
                    totalProductCount: results.totalProducts,
                    pageNum: 1,
                    paginateUrl: 'page',
                    helpers: req.handlebars.helpers,
                    showFooter: 'showFooter',
                    menu: sortMenu(menu)
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
        const page = db.pages.findOne({ pageSlug: req.params.page, pageEnabled: 'true' });
        // if we have a page lets render it, else throw 404
        if(page){
            res.render(`${config.themeViews}page`, {
                title: page.pageName,
                page: page,
                searchTerm: req.params.page,
                session: req.session,
                message: clearSessionValue(req.session, 'message'),
                messageType: clearSessionValue(req.session, 'messageType'),
                pageCloseBtn: showCartCloseBtn('page'),
                config: req.app.config,
                metaDescription: req.app.config.cartTitle + ' - ' + page,
                helpers: req.handlebars.helpers,
                showFooter: 'showFooter',
                menu: sortMenu(await getMenu(db))
            });
        }else{
            res.status(404).render('error', {
                title: '404 Error - Page not found',
                config: req.app.config,
                message: '404 Error - Page not found',
                helpers: req.handlebars.helpers,
                showFooter: 'showFooter',
                menu: sortMenu(await getMenu(db))
            });
        }
    }
});

module.exports = router;
