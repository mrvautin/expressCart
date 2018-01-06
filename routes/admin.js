let express = require('express');
let common = require('./common');
let escape = require('html-entities').AllHtmlEntities;
let async = require('async');
let colors = require('colors');
let _ = require('lodash');
let router = express.Router();

// Admin section
router.get('/', common.restrict, (req, res, next) => {
    console.log('test');
    res.redirect('/admin/orders');
});

// Admin section
router.get('/orders', common.restrict, (req, res, next) => {
    let db = req.app.db;

    // Top 10 products
    common.dbQuery(db.orders, {}, {'orderDate': -1}, 10, (err, orders) => {
        if(err){
            console.info(err.stack);
        }
        res.render('orders', {
            title: 'Cart',
            orders: orders,
            admin: true,
            config: common.getConfig(),
            session: req.session,
            message: common.clearSessionValue(req.session, 'message'),
            messageType: common.clearSessionValue(req.session, 'messageType'),
            helpers: req.handlebars.helpers
        });
    });
});

// Admin section
router.get('/orders/bystatus/:orderstatus', common.restrict, (req, res, next) => {
    let db = req.app.db;

    if(typeof req.params.orderstatus === 'undefined'){
        res.redirect('/admin/orders');
        return;
    }

    // case insensitive search
    let regex = new RegExp(['^', req.params.orderstatus, '$'].join(''), 'i');
    common.dbQuery(db.orders, {orderStatus: regex}, {'orderDate': -1}, 10, (err, orders) => {
        if(err){
            console.info(err.stack);
        }
        res.render('orders', {
            title: 'Cart',
            orders: orders,
            admin: true,
            filteredOrders: true,
            filteredStatus: req.params.orderstatus,
            config: common.getConfig(),
            session: req.session,
            message: common.clearSessionValue(req.session, 'message'),
            messageType: common.clearSessionValue(req.session, 'messageType'),
            helpers: req.handlebars.helpers
        });
    });
});

// render the editor
router.get('/order/view/:id', common.restrict, (req, res) => {
    let db = req.app.db;
    db.orders.findOne({_id: common.getId(req.params.id)}, (err, result) => {
        if(err){
            console.info(err.stack);
        }
        let productOptions = '';
        if(result.options !== {}){
            productOptions = result.options;
        }
        res.render('order', {
            title: 'View order',
            result: result,
            productOptions: productOptions,
            config: common.getConfig(),
            session: req.session,
            message: common.clearSessionValue(req.session, 'message'),
            messageType: common.clearSessionValue(req.session, 'messageType'),
            editor: true,
            admin: true,
            helpers: req.handlebars.helpers
        });
    });
});

// Admin section
router.get('/orders/filter/:search', common.restrict, (req, res, next) => {
    let db = req.app.db;
    let searchTerm = req.params.search;
    let ordersIndex = req.app.ordersIndex;
    let config = common.getConfig();

    let lunrIdArray = [];
    ordersIndex.search(searchTerm).forEach((id) => {
        if(config.databaseType !== 'embedded'){
            lunrIdArray.push(common.getId(id.ref));
        }else{
            lunrIdArray.push(id.ref);
        }
    });

    // we search on the lunr indexes
    common.dbQuery(db.orders, {_id: {$in: lunrIdArray}}, null, null, (err, orders) => {
        if(err){
            console.info(err.stack);
        }
        res.render('orders', {
            title: 'Order results',
            orders: orders,
            admin: true,
            config: common.getConfig(),
            session: req.session,
            searchTerm: searchTerm,
            message: common.clearSessionValue(req.session, 'message'),
            messageType: common.clearSessionValue(req.session, 'messageType'),
            helpers: req.handlebars.helpers
        });
    });
});

// order product
router.get('/order/delete/:id', common.restrict, (req, res) => {
    let db = req.app.db;
    let ordersIndex = req.app.ordersIndex;

    // remove the article
    db.orders.remove({_id: common.getId(req.params.id)}, {}, (err, numRemoved) => {
        if(err){
            console.info(err.stack);
        }
        // remove the index
        ordersIndex.remove({id: req.params.id}, false);

        // redirect home
        req.session.message = 'Order successfully deleted';
        req.session.messageType = 'success';
        res.redirect('/admin/orders');
    });
});

// update order status
router.post('/order/statusupdate', common.restrict, (req, res) => {
    let db = req.app.db;
    db.orders.update({_id: common.getId(req.body.order_id)}, {$set: {orderStatus: req.body.status}}, {multi: false}, (err, numReplaced) => {
        if(err){
            console.info(err.stack);
        }
        res.status(200).json({message: 'Status successfully updated'});
    });
});

// Admin section
router.get('/products', common.restrict, (req, res, next) => {
    let db = req.app.db;
    // get the top results
    common.dbQuery(db.products, {}, {'productAddedDate': -1}, 10, (err, topResults) => {
        if(err){
            console.info(err.stack);
        }
        res.render('products', {
            title: 'Cart',
            top_results: topResults,
            session: req.session,
            admin: true,
            config: common.getConfig(),
            message: common.clearSessionValue(req.session, 'message'),
            messageType: common.clearSessionValue(req.session, 'messageType'),
            helpers: req.handlebars.helpers
        });
    });
});

// Admin section
router.post('/product/addtocart', (req, res, next) => {
    let db = req.app.db;
    let productQuantity = req.body.productQuantity ? parseInt(req.body.productQuantity) : 1;

    // setup cart object if it doesn't exist
    if(!req.session.cart){
        req.session.cart = [];
    }

    db.products.findOne({_id: common.getId(req.body.productId)}, (err, product) => {
        if(err){
            console.error(colors.red('Error adding to cart', err));
        }

        if(product){
            let productPrice = parseFloat(product.productPrice).toFixed(2);

            // doc used to test if existing in the cart with the options. If not found, we add new.
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

// Updates a single product quantity
router.post('/product/updatecart', (req, res, next) => {
    let db = req.app.db;
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
                req.session.cart.splice(req.session.cart.indexOf(item), 1);
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

// Admin section
router.get('/products/filter/:search', common.restrict, (req, res, next) => {
    let db = req.app.db;
    let config = common.getConfig();
    let searchTerm = req.params.search;
    let productsIndex = req.app.productsIndex;

    let lunrIdArray = [];
    productsIndex.search(searchTerm).forEach((id) => {
        if(config.databaseType !== 'embedded'){
            lunrIdArray.push(common.getId(id.ref));
        }else{
            lunrIdArray.push(id.ref);
        }
    });

    // we search on the lunr indexes
    common.dbQuery(db.products, {_id: {$in: lunrIdArray}}, null, null, (err, results) => {
        if(err){
            console.error(colors.red('Error searching', err));
        }
        res.render('products', {
            title: 'Results',
            results: results,
            admin: true,
            config: common.getConfig(),
            session: req.session,
            searchTerm: searchTerm,
            message: common.clearSessionValue(req.session, 'message'),
            messageType: common.clearSessionValue(req.session, 'messageType'),
            helpers: req.handlebars.helpers
        });
    });
});

// insert form
router.get('/product/new', common.restrict, (req, res) => {
    res.render('product_new', {
        title: 'New product',
        session: req.session,
        productTitle: common.clearSessionValue(req.session, 'productTitle'),
        productDescription: common.clearSessionValue(req.session, 'productDescription'),
        productPrice: common.clearSessionValue(req.session, 'productPrice'),
        productPermalink: common.clearSessionValue(req.session, 'productPermalink'),
        message: common.clearSessionValue(req.session, 'message'),
        messageType: common.clearSessionValue(req.session, 'messageType'),
        editor: true,
        admin: true,
        helpers: req.handlebars.helpers,
        config: common.getConfig()
    });
});

// insert new product form action
router.post('/product/insert', common.restrict, (req, res) => {
    let db = req.app.db;
    let config = common.getConfig();
    let productsIndex = req.app.productsIndex;

    let doc = {
        productPermalink: req.body.frmProductPermalink,
        productTitle: req.body.frmProductTitle,
        productPrice: req.body.frmProductPrice,
        productDescription: req.body.frmProductDescription,
        productPublished: req.body.frmProductPublished,
        productTags: req.body.frmProductTags,
        productOptions: req.body.productOptJson,
        productAddedDate: new Date()
    };

    db.products.count({'productPermalink': req.body.frmProductPermalink}, (err, product) => {
        if(err){
            console.info(err.stack);
        }
        if(product > 0 && req.body.frmProductPermalink !== ''){
            // permalink exits
            req.session.message = 'Permalink already exists. Pick a new one.';
            req.session.messageType = 'danger';

            // keep the current stuff
            req.session.productTitle = req.body.frmProductTitle;
            req.session.productDescription = req.body.frmProductDescription;
            req.session.productPrice = req.body.frmProductPrice;
            req.session.productPermalink = req.body.frmProductPermalink;
            req.session.productPermalink = req.body.productOptJson;
            req.session.productTags = req.body.frmProductTags;

            // redirect to insert
            res.redirect('/admin/insert');
        }else{
            db.products.insert(doc, (err, newDoc) => {
                if(err){
                    console.log(colors.red('Error inserting document: ' + err));

                    // keep the current stuff
                    req.session.productTitle = req.body.frmProductTitle;
                    req.session.productDescription = req.body.frmProductDescription;
                    req.session.productPrice = req.body.frmProductPrice;
                    req.session.productPermalink = req.body.frmProductPermalink;
                    req.session.productPermalink = req.body.productOptJson;
                    req.session.productTags = req.body.frmProductTags;

                    req.session.message = 'Error: Inserting product';
                    req.session.messageType = 'danger';

                    // redirect to insert
                    res.redirect('/admin/product/new');
                }else{
                    // get the new ID
                    let newId = newDoc._id;
                    if(config.databaseType !== 'embedded'){
                        newId = newDoc.insertedIds;
                    }

                    // create lunr doc
                    let lunrDoc = {
                        productTitle: req.body.frmProductTitle,
                        productTags: req.body.frmProductTags,
                        productDescription: req.body.frmProductDescription,
                        id: newId
                    };

                    // add to lunr index
                    productsIndex.add(lunrDoc);

                    req.session.message = 'New product successfully created';
                    req.session.messageType = 'success';

                    // redirect to new doc
                    res.redirect('/admin/product/edit/' + newId);
                }
            });
        }
    });
});

// render the editor
router.get('/product/edit/:id', common.restrict, (req, res) => {
    let db = req.app.db;

    common.getImages(req.params.id, req, res, (images) => {
        db.products.findOne({_id: common.getId(req.params.id)}, (err, result) => {
            if(err){
                console.info(err.stack);
            }
            let options = {};
            if(result.productOptions){
                options = JSON.parse(result.productOptions);
            }

            res.render('product_edit', {
                title: 'Edit product',
                result: result,
                images: images,
                options: options,
                admin: true,
                session: req.session,
                message: common.clearSessionValue(req.session, 'message'),
                messageType: common.clearSessionValue(req.session, 'messageType'),
                config: common.getConfig(),
                editor: true,
                helpers: req.handlebars.helpers
            });
        });
    });
});

// Update an existing product form action
router.post('/product/update', common.restrict, (req, res) => {
    let db = req.app.db;
    let productsIndex = req.app.productsIndex;

    db.products.findOne({_id: common.getId(req.body.frmProductId)}, (err, product) => {
        if(err){
            console.info(err.stack);
            req.session.message = 'Failed updating product.';
            req.session.messageType = 'danger';
            res.redirect('/admin/product/edit/' + req.body.frmProductId);
            return;
        }
        db.products.count({'productPermalink': req.body.frmProductPermalink, _id: {$ne: common.getId(product._id)}}, (err, count) => {
            if(err){
                console.info(err.stack);
                req.session.message = 'Failed updating product.';
                req.session.messageType = 'danger';
                res.redirect('/admin/product/edit/' + req.body.frmProductId);
                return;
            }
            if(count > 0 && req.body.frmProductPermalink !== ''){
                // permalink exits
                req.session.message = 'Permalink already exists. Pick a new one.';
                req.session.messageType = 'danger';

                // keep the current stuff
                req.session.productTitle = req.body.frmProductTitle;
                req.session.productDescription = req.body.frmProductDescription;
                req.session.productPrice = req.body.frmProductPrice;
                req.session.productPermalink = req.body.frmProductPermalink;
                req.session.productTags = req.body.frmProductTags;
                req.session.productOptions = req.body.productOptJson;

                // redirect to insert
                res.redirect('/admin/product/edit/' + req.body.frmProductId);
            }else{
                common.getImages(req.body.frmProductId, req, res, (images) => {
                    let productDoc = {
                        productTitle: req.body.frmProductTitle,
                        productDescription: req.body.frmProductDescription,
                        productPublished: req.body.frmProductPublished,
                        productPrice: req.body.frmProductPrice,
                        productPermalink: req.body.frmProductPermalink,
                        productTags: req.body.frmProductTags,
                        productOptions: req.body.productOptJson
                    };

                    // if no featured image
                    if(!product.productImage){
                        if(images.length > 0){
                            productDoc['productImage'] = images[0].path;
                        }else{
                            productDoc['productImage'] = '/uploads/placeholder.png';
                        }
                    }else{
                        productDoc['productImage'] = product.productImage;
                    }

                    db.products.update({_id: common.getId(req.body.frmProductId)}, {$set: productDoc}, {}, (err, numReplaced) => {
                        if(err){
                            console.error(colors.red('Failed to save product: ' + err));
                            req.session.message = 'Failed to save. Please try again';
                            req.session.messageType = 'danger';
                            res.redirect('/admin/product/edit/' + req.body.frmProductId);
                        }else{
                            // create lunr doc
                            let lunrDoc = {
                                productTitle: req.body.frmProductTitle,
                                productTags: req.body.frmProductTags,
                                productDescription: req.body.frmProductDescription,
                                id: req.body.frmProductId
                            };

                            // update the index
                            productsIndex.update(lunrDoc, false);

                            req.session.message = 'Successfully saved';
                            req.session.messageType = 'success';
                            res.redirect('/admin/product/edit/' + req.body.frmProductId);
                        }
                    });
                });
            }
        });
    });
});

// delete product
router.get('/product/delete/:id', common.restrict, (req, res) => {
    let db = req.app.db;
    let rimraf = require('rimraf');
    let productsIndex = req.app.productsIndex;

    // remove the article
    db.products.remove({_id: common.getId(req.params.id)}, {}, (err, numRemoved) => {
        if(err){
            console.info(err.stack);
        }
        // delete any images and folder
        rimraf('public/uploads/' + req.params.id, (err) => {
            if(err){
                console.info(err.stack);
            }
            // create lunr doc
            let lunrDoc = {
                productTitle: req.body.frmProductTitle,
                productTags: req.body.frmProductTags,
                productDescription: req.body.frmProductDescription,
                id: req.body.frmProductId
            };

            // remove the index
            productsIndex.remove(lunrDoc, false);

            // redirect home
            req.session.message = 'Product successfully deleted';
            req.session.messageType = 'success';
            res.redirect('/admin/products');
        });
    });
});

// users
router.get('/users', common.restrict, (req, res) => {
    let db = req.app.db;
    common.dbQuery(db.users, {}, null, null, (err, users) => {
        if(err){
            console.info(err.stack);
        }
        res.render('users', {
            title: 'Users',
            users: users,
            admin: true,
            config: common.getConfig(),
            isAdmin: req.session.isAdmin,
            helpers: req.handlebars.helpers,
            session: req.session,
            message: common.clearSessionValue(req.session, 'message'),
            messageType: common.clearSessionValue(req.session, 'messageType')
        });
    });
});

// edit user
router.get('/user/edit/:id', common.restrict, (req, res) => {
    let db = req.app.db;
    db.users.findOne({_id: common.getId(req.params.id)}, (err, user) => {
        if(err){
            console.info(err.stack);
        }
        // if the user we want to edit is not the current logged in user and the current user is not
        // an admin we render an access denied message
        if(user.userEmail !== req.session.user && req.session.isAdmin === 'false'){
            req.session.message = 'Access denied';
            req.session.messageType = 'danger';
            res.redirect('/Users/');
            return;
        }

        res.render('user_edit', {
            title: 'User edit',
            user: user,
            admin: true,
            session: req.session,
            message: common.clearSessionValue(req.session, 'message'),
            messageType: common.clearSessionValue(req.session, 'messageType'),
            helpers: req.handlebars.helpers,
            config: common.getConfig()
        });
    });
});

// update a user
router.post('/user/update', common.restrict, (req, res) => {
    let db = req.app.db;
    let bcrypt = req.bcrypt;

    let isAdmin = req.body.user_admin === 'on' ? 'true' : 'false';

    // get the user we want to update
    db.users.findOne({_id: common.getId(req.body.userId)}, (err, user) => {
        if(err){
            console.info(err.stack);
        }
        // if the user we want to edit is not the current logged in user and the current user is not
        // an admin we render an access denied message
        if(user.userEmail !== req.session.user && req.session.isAdmin === 'false'){
            req.session.message = 'Access denied';
            req.session.messageType = 'danger';
            res.redirect('/admin/users/');
            return;
        }

        // create the update doc
        let updateDoc = {};
        updateDoc.isAdmin = isAdmin;
        updateDoc.usersName = req.body.usersName;
        if(req.body.userPassword){
            updateDoc.userPassword = bcrypt.hashSync(req.body.userPassword);
        }

        db.users.update({_id: common.getId(req.body.userId)},
            {
                $set: updateDoc
            }, {multi: false}, (err, numReplaced) => {
                if(err){
                    console.error(colors.red('Failed updating user: ' + err));
                    req.session.message = 'Failed to update user';
                    req.session.messageType = 'danger';
                    res.redirect('/admin/user/edit/' + req.body.userId);
                }else{
                    // show the view
                    req.session.message = 'User account updated.';
                    req.session.messageType = 'success';
                    res.redirect('/admin/user/edit/' + req.body.userId);
                }
            });
    });
});

// insert a user
router.post('/setup_action', (req, res) => {
    let db = req.app.db;
    let bcrypt = req.bcrypt;

    let doc = {
        usersName: req.body.usersName,
        userEmail: req.body.userEmail,
        userPassword: bcrypt.hashSync(req.body.userPassword),
        isAdmin: true
    };

    // check for users
    db.users.count({}, (err, userCount) => {
        if(err){
            console.info(err.stack);
        }
        if(userCount === 0){
            // email is ok to be used.
            db.users.insert(doc, (err, doc) => {
                // show the view
                if(err){
                    console.error(colors.red('Failed to insert user: ' + err));
                    req.session.message = 'Setup failed';
                    req.session.messageType = 'danger';
                    res.redirect('/setup');
                }else{
                    req.session.message = 'User account inserted';
                    req.session.messageType = 'success';
                    res.redirect('/login');
                }
            });
        }else{
            res.redirect('/login');
        }
    });
});

// insert a user
router.post('/user/insert', common.restrict, (req, res) => {
    let db = req.app.db;
    let bcrypt = req.bcrypt;
    let url = require('url');

    // set the account to admin if using the setup form. Eg: First user account
    let urlParts = url.parse(req.header('Referer'));

    let isAdmin = 'false';
    if(urlParts.path === '/setup'){
        isAdmin = 'true';
    }

    let doc = {
        usersName: req.body.usersName,
        userEmail: req.body.userEmail,
        userPassword: bcrypt.hashSync(req.body.userPassword),
        isAdmin: isAdmin
    };

    // check for existing user
    db.users.findOne({'userEmail': req.body.userEmail}, (err, user) => {
        if(user){
            // user already exists with that email address
            console.error(colors.red('Failed to insert user, possibly already exists: ' + err));
            req.session.message = 'A user with that email address already exists';
            req.session.messageType = 'danger';
            res.redirect('/admin/user/new');
            return;
        }
        // email is ok to be used.
        db.users.insert(doc, (err, doc) => {
            // show the view
            if(err){
                if(doc){
                    console.error(colors.red('Failed to insert user: ' + err));
                    req.session.message = 'User exists';
                    req.session.messageType = 'danger';
                    res.redirect('/admin/user/edit/' + doc._id);
                    return;
                }
                console.error(colors.red('Failed to insert user: ' + err));
                req.session.message = 'New user creation failed';
                req.session.messageType = 'danger';
                res.redirect('/admin/user/new');
                return;
            }
            req.session.message = 'User account inserted';
            req.session.messageType = 'success';

            // if from setup we add user to session and redirect to login.
            // Otherwise we show users screen
            if(urlParts.path === '/setup'){
                req.session.user = req.body.userEmail;
                res.redirect('/login');
                return;
            }
            res.redirect('/admin/users');
        });
    });
});

// users new
router.get('/user/new', common.restrict, (req, res) => {
    res.render('user_new', {
        title: 'User - New',
        admin: true,
        session: req.session,
        helpers: req.handlebars.helpers,
        message: common.clearSessionValue(req.session, 'message'),
        messageType: common.clearSessionValue(req.session, 'messageType'),
        config: common.getConfig()
    });
});

// delete user
router.get('/user/delete/:id', common.restrict, (req, res) => {
    let db = req.app.db;
    if(req.session.isAdmin === 'true'){
        db.users.remove({_id: common.getId(req.params.id)}, {}, (err, numRemoved) => {
            if(err){
                console.info(err.stack);
            }
            req.session.message = 'User deleted.';
            req.session.messageType = 'success';
            res.redirect('/admin/users');
        });
    }else{
        req.session.message = 'Access denied.';
        req.session.messageType = 'danger';
        res.redirect('/admin/users');
    }
});

// settings update
router.get('/settings', common.restrict, (req, res) => {
    res.render('settings', {
        title: 'Cart settings',
        session: req.session,
        admin: true,
        themes: common.getThemes(),
        message: common.clearSessionValue(req.session, 'message'),
        messageType: common.clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers,
        config: common.getConfig(),
        footerHtml: typeof common.getConfig().footerHtml !== 'undefined' ? escape.decode(common.getConfig().footerHtml) : null,
        googleAnalytics: typeof common.getConfig().googleAnalytics !== 'undefined' ? escape.decode(common.getConfig().googleAnalytics) : null
    });
});

// settings update
router.post('/settings/update', common.restrict, (req, res) => {
    let result = common.updateConfig(req.body);
    if(result === true){
        res.status(200).json({message: 'Settings successfully updated'});
        return;
    }
    res.status(400).json({message: 'Permission denied'});
});

// settings update
router.post('/settings/option/remove', common.restrict, (req, res) => {
    let db = req.app.db;
    db.products.findOne({_id: common.getId(req.body.productId)}, (err, product) => {
        if(err){
            console.info(err.stack);
        }
        if(product.productOptions){
            let optJson = JSON.parse(product.productOptions);
            delete optJson[req.body.optName];

            db.products.update({_id: common.getImages(req.body.productId)}, {$set: {productOptions: JSON.stringify(optJson)}}, (err, numReplaced) => {
                if(err){
                    console.info(err.stack);
                }
                if(numReplaced === 1){
                    res.status(200).json({message: 'Option successfully removed'});
                }else{
                    res.status(400).json({message: 'Failed to remove option. Please try again.'});
                }
            });
        }else{
            res.status(400).json({message: 'Product not found.'});
        }
    });
});

// settings update
router.get('/settings/menu', common.restrict, (req, res) => {
    res.render('settings_menu', {
        title: 'Cart menu',
        session: req.session,
        admin: true,
        message: common.clearSessionValue(req.session, 'message'),
        messageType: common.clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers,
        config: common.getConfig(),
        menu: common.getMenu().items
    });
});

// settings page list
router.get('/settings/pages', common.restrict, (req, res) => {
    let db = req.app.db;
    common.dbQuery(db.pages, {}, null, null, (err, pages) => {
        if(err){
            console.info(err.stack);
        }
        res.render('settings_pages', {
            title: 'Static pages',
            pages: pages,
            session: req.session,
            admin: true,
            message: common.clearSessionValue(req.session, 'message'),
            messageType: common.clearSessionValue(req.session, 'messageType'),
            helpers: req.handlebars.helpers,
            config: common.getConfig(),
            menu: common.getMenu().items
        });
    });
});

// settings pages new
router.get('/settings/pages/new', common.restrict, (req, res) => {
    res.render('settings_page_edit', {
        title: 'Static pages',
        session: req.session,
        admin: true,
        button_text: 'Create',
        message: common.clearSessionValue(req.session, 'message'),
        messageType: common.clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers,
        config: common.getConfig(),
        menu: common.getMenu().items
    });
});

// settings pages editor
router.get('/settings/pages/edit/:page', common.restrict, (req, res) => {
    let db = req.app.db;
    db.pages.findOne({_id: common.getId(req.params.page)}, (err, page) => {
        if(err){
            console.info(err.stack);
        }
        // page found
        if(page){
            res.render('settings_page_edit', {
                title: 'Static pages',
                page: page,
                button_text: 'Update',
                session: req.session,
                admin: true,
                message: common.clearSessionValue(req.session, 'message'),
                messageType: common.clearSessionValue(req.session, 'messageType'),
                helpers: req.handlebars.helpers,
                config: common.getConfig(),
                menu: common.getMenu().items
            });
        }else{
            // 404 it!
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
});

// settings update page
router.post('/settings/pages/update', common.restrict, (req, res) => {
    let db = req.app.db;

    let doc = {
        pageName: req.body.pageName,
        pageSlug: req.body.pageSlug,
        pageEnabled: req.body.pageEnabled,
        pageContent: req.body.pageContent
    };

    if(req.body.page_id){
        // existing page
        db.pages.findOne({_id: common.getId(req.body.page_id)}, (err, page) => {
            if(err){
                console.info(err.stack);
            }
            if(page){
                db.pages.update({_id: common.getId(req.body.page_id)}, {$set: doc}, {}, (err, numReplaced) => {
                    if(err){
                        console.info(err.stack);
                    }
                    res.status(200).json({message: 'Page updated successfully', page_id: req.body.page_id});
                });
            }else{
                res.status(400).json({message: 'Page not found'});
            }
        });
    }else{
        // insert page
        db.pages.insert(doc, (err, newDoc) => {
            if(err){
                res.status(400).json({message: 'Error creating page. Please try again.'});
            }else{
                res.status(200).json({message: 'New page successfully created', page_id: newDoc._id});
            }
        });
    }
});

// settings delete page
router.get('/settings/pages/delete/:page', common.restrict, (req, res) => {
    let db = req.app.db;
    db.pages.remove({_id: common.getId(req.params.page)}, {}, (err, numRemoved) => {
        if(err){
            req.session.message = 'Error deleting page. Please try again.';
            req.session.messageType = 'danger';
            res.redirect('/admin/settings/pages');
            return;
        }
        req.session.message = 'Page successfully deleted';
        req.session.messageType = 'success';
        res.redirect('/admin/settings/pages');
    });
});

// new menu item
router.post('/settings/menu/new', common.restrict, (req, res) => {
    let result = common.newMenu(req, res);
    if(result === false){
        req.session.message = 'Failed creating menu.';
        req.session.messageType = 'danger';
    }
    res.redirect('/admin/settings/menu');
});

// update existing menu item
router.post('/settings/menu/update', common.restrict, (req, res) => {
    let result = common.updateMenu(req, res);
    if(result === false){
        req.session.message = 'Failed updating menu.';
        req.session.messageType = 'danger';
    }
    res.redirect('/admin/settings/menu');
});

// delete menu item
router.get('/settings/menu/delete/:menuid', common.restrict, (req, res) => {
    let result = common.deleteMenu(req, res, req.params.menuid);
    if(result === false){
        req.session.message = 'Failed deleting menu.';
        req.session.messageType = 'danger';
    }
    res.redirect('/admin/settings/menu');
});

// We call this via a Ajax call to save the order from the sortable list
router.post('/settings/menu/save_order', common.restrict, (req, res) => {
    let result = common.orderMenu(req, res);
    if(result === false){
        res.status(400).json({message: 'Failed saving menu order'});
        return;
    }
    res.status(200);
});

// validate the permalink
router.post('/api/validate_permalink', (req, res) => {
    // if doc id is provided it checks for permalink in any products other that one provided,
    // else it just checks for any products with that permalink
    let db = req.app.db;

    let query = {};
    if(typeof req.body.docId === 'undefined' || req.body.docId === ''){
        query = {productPermalink: req.body.permalink};
    }else{
        query = {productPermalink: req.body.permalink, _id: {$ne: common.getId(req.body.docId)}};
    }

    db.products.count(query, (err, products) => {
        if(err){
            console.info(err.stack);
        }
        if(products > 0){
            res.writeHead(400, {'Content-Type': 'application/text'});
            res.end('Permalink already exists');
        }else{
            res.writeHead(200, {'Content-Type': 'application/text'});
            res.end('Permalink validated successfully');
        }
    });
});

// update the published state based on an ajax call from the frontend
router.post('/product/published_state', common.restrict, (req, res) => {
    let db = req.app.db;

    db.products.update({_id: common.getId(req.body.id)}, {$set: {productPublished: req.body.state}}, {multi: false}, (err, numReplaced) => {
        if(err){
            console.error(colors.red('Failed to update the published state: ' + err));
            res.writeHead(400, {'Content-Type': 'application/text'});
            res.end('Published state not updated');
        }else{
            res.writeHead(200, {'Content-Type': 'application/text'});
            res.end('Published state updated');
        }
    });
});

// set as main product image
router.post('/product/setasmainimage', common.restrict, (req, res) => {
    let db = req.app.db;

    // update the productImage to the db
    db.products.update({_id: common.getId(req.body.product_id)}, {$set: {productImage: req.body.productImage}}, {multi: false}, (err, numReplaced) => {
        console.log(err, numReplaced);
        if(err){
            res.status(400).json({message: 'Unable to set as main image. Please try again.'});
        }else{
            res.status(200).json({message: 'Main image successfully set'});
        }
    });
});

// deletes a product image
router.post('/product/deleteimage', common.restrict, (req, res) => {
    let db = req.app.db;
    let fs = require('fs');
    let path = require('path');

    // get the productImage from the db
    db.products.findOne({_id: common.getId(req.body.product_id)}, (err, product) => {
        if(err){
            console.info(err.stack);
        }
        if(req.body.productImage === product.productImage){
            // set the produt_image to null
            db.products.update({_id: common.getId(req.body.product_id)}, {$set: {productImage: null}}, {multi: false}, (err, numReplaced) => {
                if(err){
                    console.info(err.stack);
                }
                // remove the image from disk
                fs.unlink(path.join('public', req.body.productImage), (err) => {
                    if(err){
                        res.status(400).json({message: 'Image not removed, please try again.'});
                    }else{
                        res.status(200).json({message: 'Image successfully deleted'});
                    }
                });
            });
        }else{
            // remove the image from disk
            fs.unlink(path.join('public', req.body.productImage), (err) => {
                if(err){
                    res.status(400).json({message: 'Image not removed, please try again.'});
                }else{
                    res.status(200).json({message: 'Image successfully deleted'});
                }
            });
        }
    });
});

// upload the file
let multer = require('multer');
let upload = multer({dest: 'public/uploads/'});
router.post('/file/upload', common.restrict, upload.single('upload_file'), (req, res, next) => {
    let db = req.app.db;
    let fs = require('fs');
    let path = require('path');

    if(req.file){
        // check for upload select
        let uploadDir = path.join('public/uploads', req.body.directory);

        // Check directory and create (if needed)
        common.checkDirectorySync(uploadDir);

        let file = req.file;
        let source = fs.createReadStream(file.path);
        let dest = fs.createWriteStream(path.join(uploadDir, file.originalname.replace(/ /g, '_')));

        // save the new file
        source.pipe(dest);
        source.on('end', () => { });

        // delete the temp file.
        fs.unlink(file.path, (err) => {
            if(err){
                console.info(err.stack);
            }
        });

        // get the product form the DB
        db.products.findOne({_id: common.getId(req.body.directory)}, (err, product) => {
            if(err){
                console.info(err.stack);
            }
            let imagePath = path.join('/uploads', req.body.directory, file.originalname.replace(/ /g, '_'));

            // if there isn't a product featured image, set this one
            if(!product.productImage){
                db.products.update({_id: common.getId(req.body.directory)}, {$set: {productImage: imagePath}}, {multi: false}, (err, numReplaced) => {
                    if(err){
                        console.info(err.stack);
                    }
                    req.session.message = 'File uploaded successfully';
                    req.session.messageType = 'success';
                    res.redirect('/admin/product/edit/' + req.body.directory);
                });
            }else{
                req.session.message = 'File uploaded successfully';
                req.session.messageType = 'success';
                res.redirect('/admin/product/edit/' + req.body.directory);
            }
        });
    }else{
        req.session.message = 'File upload error. Please select a file.';
        req.session.messageType = 'danger';
        res.redirect('/admin/product/edit/' + req.body.directory);
    }
});

// delete a file via ajax request
router.post('/testEmail', common.restrict, (req, res) => {
    let config = common.getConfig();
    common.sendEmail(config.emailAddress, 'expressCart test email', 'Your email settings are working');
    res.status(200).json('Test email sent');
});

// delete a file via ajax request
router.post('/file/delete', common.restrict, (req, res) => {
    let fs = require('fs');

    req.session.message = null;
    req.session.messageType = null;

    fs.unlink('public/' + req.body.img, (err) => {
        if(err){
            console.error(colors.red('File delete error: ' + err));
            res.writeHead(400, {'Content-Type': 'application/text'});
            res.end('Failed to delete file: ' + err);
        }else{
            res.writeHead(200, {'Content-Type': 'application/text'});
            res.end('File deleted successfully');
        }
    });
});

router.get('/files', common.restrict, (req, res) => {
    let glob = require('glob');
    let fs = require('fs');

    // loop files in /public/uploads/
    glob('public/uploads/**', {nosort: true}, (er, files) => {
        // sort array
        files.sort();

        // declare the array of objects
        let fileList = [];
        let dirList = [];

        // loop these files
        for(let i = 0; i < files.length; i++){
            // only want files
            if(fs.lstatSync(files[i]).isDirectory() === false){
                // declare the file object and set its values
                let file = {
                    id: i,
                    path: files[i].substring(6)
                };

                // push the file object into the array
                fileList.push(file);
            }else{
                let dir = {
                    id: i,
                    path: files[i].substring(6)
                };

                // push the dir object into the array
                dirList.push(dir);
            }
        }

        // render the files route
        res.render('files', {
            title: 'Files',
            files: fileList,
            admin: true,
            dirs: dirList,
            session: req.session,
            config: common.get(),
            message: common.clearSessionValue(req.session, 'message'),
            messageType: common.clearSessionValue(req.session, 'messageType')
        });
    });
});

module.exports = router;
