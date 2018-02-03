const express = require('express');
const common = require('./common');
const escape = require('html-entities').AllHtmlEntities;
const colors = require('colors');
const router = express.Router();

// Admin section
router.get('/', common.restrict, (req, res, next) => {
    res.redirect('/admin/orders');
});

// Admin section
router.get('/orders', common.restrict, (req, res, next) => {
    const db = req.app.db;

    // Top 10 products
    db.orders.find({}).sort({'orderDate': -1}).limit(10).toArray((err, orders) => {
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
    const db = req.app.db;

    if(typeof req.params.orderstatus === 'undefined'){
        res.redirect('/admin/orders');
        return;
    }

    // case insensitive search
    let regex = new RegExp(['^', req.params.orderstatus, '$'].join(''), 'i');
    db.orders.find({orderStatus: regex}).sort({'orderDate': -1}).limit(10).toArray((err, orders) => {
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
    const db = req.app.db;
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
    const db = req.app.db;
    let searchTerm = req.params.search;
    let ordersIndex = req.app.ordersIndex;

    let lunrIdArray = [];
    ordersIndex.search(searchTerm).forEach((id) => {
        lunrIdArray.push(common.getId(id.ref));
    });

    // we search on the lunr indexes
    db.orders.find({_id: {$in: lunrIdArray}}).toArray((err, orders) => {
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
    const db = req.app.db;

    // remove the article
    db.orders.remove({_id: common.getId(req.params.id)}, {}, (err, numRemoved) => {
        if(err){
            console.info(err.stack);
        }
        // remove the index
        common.indexOrders(req.app)
        .then(() => {
            // redirect home
            req.session.message = 'Order successfully deleted';
            req.session.messageType = 'success';
            res.redirect('/admin/orders');
        });
    });
});

// update order status
router.post('/order/statusupdate', common.restrict, (req, res) => {
    const db = req.app.db;
    db.orders.update({_id: common.getId(req.body.order_id)}, {$set: {orderStatus: req.body.status}}, {multi: false}, (err, numReplaced) => {
        if(err){
            console.info(err.stack);
        }
        res.status(200).json({message: 'Status successfully updated'});
    });
});

// Admin section
router.get('/products', common.restrict, (req, res, next) => {
    const db = req.app.db;
    // get the top results
    db.products.find({}).sort({'productAddedDate': -1}).limit(10).toArray((err, topResults) => {
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
            res.redirect('/admin/setup');
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
            res.redirect('/admin/setup');
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
            res.redirect('/admin/login');
            return;
        }

        // check if user exists with that email
        if(user === undefined || user === null){
            req.session.message = 'A user with that email does not exist.';
            req.session.messageType = 'danger';
            res.redirect('/admin/login');
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
                res.redirect('/admin/login');
            }
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
            res.redirect('/admin/login');
        }
    });
});

// Admin section
router.get('/products/filter/:search', common.restrict, (req, res, next) => {
    const db = req.app.db;
    let searchTerm = req.params.search;
    let productsIndex = req.app.productsIndex;

    let lunrIdArray = [];
    productsIndex.search(searchTerm).forEach((id) => {
        lunrIdArray.push(common.getId(id.ref));
    });

    // we search on the lunr indexes
    db.products.find({_id: {$in: lunrIdArray}}).toArray((err, results) => {
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
    const db = req.app.db;

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
                    let newId = newDoc.insertedIds[0];

                    // add to lunr index
                    common.indexProducts(req.app)
                    .then(() => {
                        req.session.message = 'New product successfully created';
                        req.session.messageType = 'success';

                        // redirect to new doc
                        res.redirect('/admin/product/edit/' + newId);
                    });
                }
            });
        }
    });
});

// render the editor
router.get('/product/edit/:id', common.restrict, (req, res) => {
    const db = req.app.db;

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
    const db = req.app.db;

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
                            // Update the index
                            common.indexProducts(req.app)
                            .then(() => {
                                req.session.message = 'Successfully saved';
                                req.session.messageType = 'success';
                                res.redirect('/admin/product/edit/' + req.body.frmProductId);
                            });
                        }
                    });
                });
            }
        });
    });
});

// delete product
router.get('/product/delete/:id', common.restrict, (req, res) => {
    const db = req.app.db;
    let rimraf = require('rimraf');

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

            // remove the index
            common.indexProducts(req.app)
            .then(() => {
                // redirect home
                req.session.message = 'Product successfully deleted';
                req.session.messageType = 'success';
                res.redirect('/admin/products');
            });
        });
    });
});

// users
router.get('/users', common.restrict, (req, res) => {
    const db = req.app.db;
    db.users.find({}).toArray((err, users) => {
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
    const db = req.app.db;
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
    const db = req.app.db;
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
    const db = req.app.db;
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
                    res.redirect('/admin/setup');
                }else{
                    req.session.message = 'User account inserted';
                    req.session.messageType = 'success';
                    res.redirect('/admin/login');
                }
            });
        }else{
            res.redirect('/admin/login');
        }
    });
});

// insert a user
router.post('/user/insert', common.restrict, (req, res) => {
    const db = req.app.db;
    let bcrypt = req.bcrypt;
    let url = require('url');

    // set the account to admin if using the setup form. Eg: First user account
    let urlParts = url.parse(req.header('Referer'));

    let isAdmin = 'false';
    if(urlParts.path === '/admin/setup'){
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
            if(urlParts.path === '/admin/setup'){
                req.session.user = req.body.userEmail;
                res.redirect('/admin/login');
                return;
            }
            res.redirect('/admin/users');
        });
    });
});

// render the customer view
router.get('/customer/view/:id?', common.restrict, (req, res) => {
    const db = req.app.db;

    console.log('here');

    db.customers.findOne({_id: common.getId(req.params.id)}, (err, result) => {
        if(err){
            console.info(err.stack);
        }

        res.render('customer', {
            title: 'View customer',
            result: result,
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

// customers list
router.get('/customers', common.restrict, (req, res) => {
    const db = req.app.db;

    db.customers.find({}).limit(20).sort({created: -1}).toArray((err, customers) => {
        res.render('customers', {
            title: 'Customers - List',
            admin: true,
            customers: customers,
            session: req.session,
            helpers: req.handlebars.helpers,
            message: common.clearSessionValue(req.session, 'message'),
            messageType: common.clearSessionValue(req.session, 'messageType'),
            config: common.getConfig()
        });
    });
});

// Filtered customers list
router.get('/customers/filter/:search', common.restrict, (req, res, next) => {
    const db = req.app.db;
    let searchTerm = req.params.search;
    let customersIndex = req.app.customersIndex;

    let lunrIdArray = [];
    customersIndex.search(searchTerm).forEach((id) => {
        lunrIdArray.push(common.getId(id.ref));
    });

    // we search on the lunr indexes
    db.customers.find({_id: {$in: lunrIdArray}}).sort({created: -1}).toArray((err, customers) => {
        if(err){
            console.error(colors.red('Error searching', err));
        }
        res.render('customers', {
            title: 'Customer results',
            customers: customers,
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
    const db = req.app.db;
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
    const db = req.app.db;
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
router.get('/settings/menu', common.restrict, async (req, res) => {
    const db = req.app.db;
    res.render('settings_menu', {
        title: 'Cart menu',
        session: req.session,
        admin: true,
        message: common.clearSessionValue(req.session, 'message'),
        messageType: common.clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers,
        config: common.getConfig(),
        menu: common.sortMenu(await common.getMenu(db))
    });
});

// settings page list
router.get('/settings/pages', common.restrict, (req, res) => {
    const db = req.app.db;
    db.pages.find({}).toArray(async (err, pages) => {
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
            menu: common.sortMenu(await common.getMenu(db))
        });
    });
});

// settings pages new
router.get('/settings/pages/new', common.restrict, async (req, res) => {
    const db = req.app.db;

    res.render('settings_page_edit', {
        title: 'Static pages',
        session: req.session,
        admin: true,
        button_text: 'Create',
        message: common.clearSessionValue(req.session, 'message'),
        messageType: common.clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers,
        config: common.getConfig(),
        menu: common.sortMenu(await common.getMenu(db))
    });
});

// settings pages editor
router.get('/settings/pages/edit/:page', common.restrict, (req, res) => {
    const db = req.app.db;
    db.pages.findOne({_id: common.getId(req.params.page)}, async (err, page) => {
        if(err){
            console.info(err.stack);
        }
        // page found
        const menu = common.sortMenu(await common.getMenu(db));
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
                menu
            });
        }else{
            // 404 it!
            res.status(404).render('error', {
                title: '404 Error - Page not found',
                config: common.getConfig(),
                message: '404 Error - Page not found',
                helpers: req.handlebars.helpers,
                showFooter: 'showFooter',
                menu
            });
        }
    });
});

// settings update page
router.post('/settings/pages/update', common.restrict, (req, res) => {
    const db = req.app.db;

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
    const db = req.app.db;
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
    const db = req.app.db;

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
    const db = req.app.db;

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
    const db = req.app.db;

    // update the productImage to the db
    db.products.update({_id: common.getId(req.body.product_id)}, {$set: {productImage: req.body.productImage}}, {multi: false}, (err, numReplaced) => {
        if(err){
            res.status(400).json({message: 'Unable to set as main image. Please try again.'});
        }else{
            res.status(200).json({message: 'Main image successfully set'});
        }
    });
});

// deletes a product image
router.post('/product/deleteimage', common.restrict, (req, res) => {
    const db = req.app.db;
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
    const db = req.app.db;
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
        db.products.findOne({_id: common.getId(req.body.productId)}, (err, product) => {
            if(err){
                console.info(err.stack);
            }
            let imagePath = path.join('/uploads', req.body.directory, file.originalname.replace(/ /g, '_'));

            // if there isn't a product featured image, set this one
            if(!product.productImage){
                db.products.update({_id: common.getId(req.body.productId)}, {$set: {productImage: imagePath}}, {multi: false}, (err, numReplaced) => {
                    if(err){
                        console.info(err.stack);
                    }
                    req.session.message = 'File uploaded successfully';
                    req.session.messageType = 'success';
                    res.redirect('/admin/product/edit/' + req.body.productId);
                });
            }else{
                req.session.message = 'File uploaded successfully';
                req.session.messageType = 'success';
                res.redirect('/admin/product/edit/' + req.body.productId);
            }
        });
    }else{
        req.session.message = 'File upload error. Please select a file.';
        req.session.messageType = 'danger';
        res.redirect('/admin/product/edit/' + req.body.productId);
    }
});

// delete a file via ajax request
router.post('/testEmail', common.restrict, (req, res) => {
    let config = common.getConfig();
    // TODO: Should fix this to properly handle result
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
