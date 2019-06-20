const express = require('express');
const common = require('../lib/common');
const { restrict, checkAccess } = require('../lib/auth');
const { indexProducts } = require('../lib/indexing');
const { validateJson } = require('../lib/schema');
const colors = require('colors');
const rimraf = require('rimraf');
const fs = require('fs');
const path = require('path');
const router = express.Router();

router.get('/admin/products', restrict, (req, res, next) => {
    const db = req.app.db;
    // get the top results
    db.products.find({}).sort({ 'productAddedDate': -1 }).limit(10).toArray((err, topResults) => {
        if(err){
            console.info(err.stack);
        }
        res.render('products', {
            title: 'Cart',
            top_results: topResults,
            session: req.session,
            admin: true,
            config: req.app.config,
            message: common.clearSessionValue(req.session, 'message'),
            messageType: common.clearSessionValue(req.session, 'messageType'),
            helpers: req.handlebars.helpers
        });
    });
});

router.get('/admin/products/filter/:search', (req, res, next) => {
    const db = req.app.db;
    let searchTerm = req.params.search;
    let productsIndex = req.app.productsIndex;

    let lunrIdArray = [];
    productsIndex.search(searchTerm).forEach((id) => {
        lunrIdArray.push(common.getId(id.ref));
    });

    // we search on the lunr indexes
    db.products.find({ _id: { $in: lunrIdArray } }).toArray((err, results) => {
        if(err){
            console.error(colors.red('Error searching', err));
        }
        res.render('products', {
            title: 'Results',
            results: results,
            admin: true,
            config: req.app.config,
            session: req.session,
            searchTerm: searchTerm,
            message: common.clearSessionValue(req.session, 'message'),
            messageType: common.clearSessionValue(req.session, 'messageType'),
            helpers: req.handlebars.helpers
        });
    });
});

// insert form
router.get('/admin/product/new', restrict, checkAccess, (req, res) => {
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
        config: req.app.config
    });
});

// insert new product form action
router.post('/admin/product/insert', restrict, checkAccess, (req, res) => {
    const db = req.app.db;

    // Process supplied options
    let productOptions = req.body.productOptions;
    if(productOptions && typeof productOptions !== 'object'){
        try{
            productOptions = JSON.parse(req.body.productOptions);
        }catch(ex){
            console.log('Failure to parse options');
        }
    }

    let doc = {
        productPermalink: req.body.productPermalink,
        productTitle: common.cleanHtml(req.body.productTitle),
        productPrice: common.safeParseInt(req.body.productPrice),
        productDescription: common.cleanHtml(req.body.productDescription),
        productPublished: common.convertBool(req.body.productPublished),
        productTags: req.body.productTags,
        productOptions: productOptions || null,
        productComment: common.checkboxBool(req.body.productComment),
        productAddedDate: new Date(),
        productStock: common.safeParseInt(req.body.productStock) || null
    };

    // Validate the body again schema
    const schemaResult = validateJson('newProduct', doc);
    if(!schemaResult.valid){
        // If API request, return json
        if(req.apiAuthenticated){
            res.status(400).json(schemaResult.errors);
            return;
        }

        console.log('schemaResult errors', schemaResult.errors);
        req.session.message = 'Form invalid. Please check values and try again.';
        req.session.messageType = 'danger';

        // keep the current stuff
        req.session.productTitle = req.body.productTitle;
        req.session.productDescription = req.body.productDescription;
        req.session.productPrice = req.body.productPrice;
        req.session.productPermalink = req.body.productPermalink;
        req.session.productOptions = productOptions;
        req.session.productComment = common.checkboxBool(req.body.productComment);
        req.session.productTags = req.body.productTags;
        req.session.productStock = req.body.productStock ? parseInt(req.body.productStock) : null;

        // redirect to insert
        res.redirect('/admin/product/new');
        return;
    }

    db.products.count({ 'productPermalink': req.body.productPermalink }, (err, product) => {
        if(err){
            console.info(err.stack);
        }
        if(product > 0 && req.body.productPermalink !== ''){
            // permalink exits
            req.session.message = 'Permalink already exists. Pick a new one.';
            req.session.messageType = 'danger';

            // keep the current stuff
            req.session.productTitle = req.body.productTitle;
            req.session.productDescription = req.body.productDescription;
            req.session.productPrice = req.body.productPrice;
            req.session.productPermalink = req.body.productPermalink;
            req.session.productOptions = productOptions;
            req.session.productComment = common.checkboxBool(req.body.productComment);
            req.session.productTags = req.body.productTags;
            req.session.productStock = req.body.productStock ? parseInt(req.body.productStock) : null;

            // If API request, return json
            if(req.apiAuthenticated){
                res.status(400).json({ error: 'Permalink already exists. Pick a new one.' });
                return;
            }

            // redirect to insert
            res.redirect('/admin/product/new');
            return;
        }
        db.products.insert(doc, (err, newDoc) => {
            if(err){
                console.log(colors.red('Error inserting document: ' + err));

                // keep the current stuff
                req.session.productTitle = req.body.productTitle;
                req.session.productDescription = req.body.productDescription;
                req.session.productPrice = req.body.productPrice;
                req.session.productPermalink = req.body.productPermalink;
                req.session.productOptions = productOptions;
                req.session.productComment = common.checkboxBool(req.body.productComment);
                req.session.productTags = req.body.productTags;
                req.session.productStock = req.body.productStock ? parseInt(req.body.productStock) : null;

                req.session.message = 'Error: Inserting product';
                req.session.messageType = 'danger';

                // If API request, return json
                if(req.apiAuthenticated){
                    res.status(400).json({ error: `Error inserting document: ${err}` });
                    return;
                }

                // redirect to insert
                res.redirect('/admin/product/new');
                return;
            }
            // get the new ID
            let newId = newDoc.insertedIds[0];

            // add to lunr index
            indexProducts(req.app)
            .then(() => {
                req.session.message = 'New product successfully created';
                req.session.messageType = 'success';

                // If API request, return json
                if(req.apiAuthenticated){
                    res.status(200).json({ message: 'New product successfully created' });
                    return;
                }

                // redirect to new doc
                res.redirect('/admin/product/edit/' + newId);
            });
        });
    });
});

// render the editor
router.get('/admin/product/edit/:id', restrict, checkAccess, (req, res) => {
    const db = req.app.db;

    common.getImages(req.params.id, req, res, (images) => {
        db.products.findOne({ _id: common.getId(req.params.id) }, (err, result) => {
            if(err){
                console.info(err.stack);
            }
            let options = {};
            if(result.productOptions){
                options = result.productOptions;
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
                config: req.app.config,
                editor: true,
                helpers: req.handlebars.helpers
            });
        });
    });
});

// Update an existing product form action
router.post('/admin/product/update', restrict, checkAccess, (req, res) => {
    const db = req.app.db;

    db.products.findOne({ _id: common.getId(req.body.productId) }, (err, product) => {
        if(err){
            console.info(err.stack);
            req.session.message = 'Failed updating product.';
            req.session.messageType = 'danger';

            // If API request, return json
            if(req.apiAuthenticated){
                res.status(400).json({ messge: 'Failed to update product' });
                return;
            }

            res.redirect('/admin/product/edit/' + req.body.productId);
            return;
        }
        db.products.count({ 'productPermalink': req.body.productPermalink, _id: { $ne: common.getId(product._id) } }, (err, count) => {
            if(err){
                console.info(err.stack);

                // If API request, return json
                if(req.apiAuthenticated){
                    res.status(400).json({ messge: 'Failed to update product' });
                    return;
                }

                req.session.message = 'Failed updating product.';
                req.session.messageType = 'danger';
                res.redirect('/admin/product/edit/' + req.body.productId);
                return;
            }

            if(count > 0 && req.body.productPermalink !== ''){
                // If API request, return json
                if(req.apiAuthenticated){
                    res.status(400).json({ messge: 'Permalink already exists. Pick a new one' });
                    return;
                }

                // permalink exits
                req.session.message = 'Permalink already exists. Pick a new one.';
                req.session.messageType = 'danger';

                // keep the current stuff
                req.session.productTitle = req.body.productTitle;
                req.session.productDescription = req.body.productDescription;
                req.session.productPrice = req.body.productPrice;
                req.session.productPermalink = req.body.productPermalink;
                req.session.productTags = req.body.productTags;
                req.session.productOptions = req.body.productOptions;
                req.session.productComment = common.checkboxBool(req.body.productComment);
                req.session.productStock = req.body.productStock ? req.body.productStock : null;

                // redirect to insert
                res.redirect('/admin/product/edit/' + req.body.productId);
            }else{
                common.getImages(req.body.productId, req, res, (images) => {
                    // Process supplied options
                    let productOptions = req.body.productOptions;
                    if(productOptions && typeof productOptions !== 'object'){
                        try{
                            productOptions = JSON.parse(req.body.productOptions);
                        }catch(ex){
                            console.log('Failure to parse options');
                        }
                    }

                    let productDoc = {
                        productId: req.body.productId,
                        productPermalink: req.body.productPermalink,
                        productTitle: common.cleanHtml(req.body.productTitle),
                        productPrice: common.safeParseInt(req.body.productPrice),
                        productDescription: common.cleanHtml(req.body.productDescription),
                        productPublished: common.convertBool(req.body.productPublished),
                        productTags: req.body.productTags,
                        productOptions: productOptions || null,
                        productComment: common.checkboxBool(req.body.productComment),
                        productStock: common.safeParseInt(req.body.productStock) || null
                    };

                    // Validate the body again schema
                    const schemaResult = validateJson('editProduct', productDoc);
                    if(!schemaResult.valid){
                        // If API request, return json
                        if(req.apiAuthenticated){
                            res.status(400).json(schemaResult.errors);
                            return;
                        }

                        req.session.message = 'Form invalid. Please check values and try again.';
                        req.session.messageType = 'danger';

                        // keep the current stuff
                        req.session.productTitle = req.body.productTitle;
                        req.session.productDescription = req.body.productDescription;
                        req.session.productPrice = req.body.productPrice;
                        req.session.productPermalink = req.body.productPermalink;
                        req.session.productOptions = productOptions;
                        req.session.productComment = common.checkboxBool(req.body.productComment);
                        req.session.productTags = req.body.productTags;
                        req.session.productStock = req.body.productStock ? parseInt(req.body.productStock) : null;

                        // redirect to insert
                        res.redirect('/admin/product/edit/' + req.body.productId);
                        return;
                    }

                    // Remove productId from doc
                    delete productDoc.productId;

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

                    db.products.update({ _id: common.getId(req.body.productId) }, { $set: productDoc }, {}, (err, numReplaced) => {
                        if(err){
                            // If API request, return json
                            if(req.apiAuthenticated){
                                res.status(400).json({ messge: 'Failed to save. Please try again' });
                                return;
                            }

                            console.error(colors.red('Failed to save product: ' + err));
                            req.session.message = 'Failed to save. Please try again';
                            req.session.messageType = 'danger';
                            res.redirect('/admin/product/edit/' + req.body.productId);
                        }else{
                            // Update the index
                            indexProducts(req.app)
                            .then(() => {
                                // If API request, return json
                                if(req.apiAuthenticated){
                                    res.status(200).json({ message: 'Successfully saved', product: productDoc });
                                    return;
                                }

                                req.session.message = 'Successfully saved';
                                req.session.messageType = 'success';
                                res.redirect('/admin/product/edit/' + req.body.productId);
                            });
                        }
                    });
                });
            }
        });
    });
});

// delete product
router.get('/admin/product/delete/:id', restrict, checkAccess, (req, res) => {
    const db = req.app.db;

    // remove the article
    db.products.remove({ _id: common.getId(req.params.id) }, {}, (err, numRemoved) => {
        if(err){
            console.info(err.stack);
        }
        // delete any images and folder
        rimraf('public/uploads/' + req.params.id, (err) => {
            if(err){
                console.info(err.stack);
            }

            // remove the index
            indexProducts(req.app)
            .then(() => {
                // redirect home
                req.session.message = 'Product successfully deleted';
                req.session.messageType = 'success';
                res.redirect('/admin/products');
            });
        });
    });
});

// update the published state based on an ajax call from the frontend
router.post('/admin/product/published_state', restrict, checkAccess, (req, res) => {
    const db = req.app.db;

    db.products.update({ _id: common.getId(req.body.id) }, { $set: { productPublished: req.body.state } }, { multi: false }, (err, numReplaced) => {
        if(err){
            console.error(colors.red('Failed to update the published state: ' + err));
            res.status(400).json('Published state not updated');
        }else{
            res.status(200).json('Published state updated');
        }
    });
});

// set as main product image
router.post('/admin/product/setasmainimage', restrict, checkAccess, (req, res) => {
    const db = req.app.db;

    // update the productImage to the db
    db.products.update({ _id: common.getId(req.body.product_id) }, { $set: { productImage: req.body.productImage } }, { multi: false }, (err, numReplaced) => {
        if(err){
            res.status(400).json({ message: 'Unable to set as main image. Please try again.' });
        }else{
            res.status(200).json({ message: 'Main image successfully set' });
        }
    });
});

// deletes a product image
router.post('/admin/product/deleteimage', restrict, checkAccess, (req, res) => {
    const db = req.app.db;

    // get the productImage from the db
    db.products.findOne({ _id: common.getId(req.body.product_id) }, (err, product) => {
        if(err){
            console.info(err.stack);
        }
        if(req.body.productImage === product.productImage){
            // set the produt_image to null
            db.products.update({ _id: common.getId(req.body.product_id) }, { $set: { productImage: null } }, { multi: false }, (err, numReplaced) => {
                if(err){
                    console.info(err.stack);
                }
                // remove the image from disk
                fs.unlink(path.join('public', req.body.productImage), (err) => {
                    if(err){
                        res.status(400).json({ message: 'Image not removed, please try again.' });
                    }else{
                        res.status(200).json({ message: 'Image successfully deleted' });
                    }
                });
            });
        }else{
            // remove the image from disk
            fs.unlink(path.join('public', req.body.productImage), (err) => {
                if(err){
                    res.status(400).json({ message: 'Image not removed, please try again.' });
                }else{
                    res.status(200).json({ message: 'Image successfully deleted' });
                }
            });
        }
    });
});

module.exports = router;
