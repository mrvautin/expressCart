const express = require('express');
const common = require('../lib/common');
const colors = require('colors');
const rimraf = require('rimraf');
const fs = require('fs');
const path = require('path');
const router = express.Router();

router.get('/admin/products', common.restrict, (req, res, next) => {
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
    db.products.find({_id: {$in: lunrIdArray}}).toArray((err, results) => {
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
router.get('/admin/product/new', common.restrict, common.checkAccess, (req, res) => {
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
router.post('/admin/product/insert', common.restrict, common.checkAccess, (req, res) => {
    const db = req.app.db;

    let doc = {
        productPermalink: req.body.frmProductPermalink,
        productTitle: common.cleanHtml(req.body.frmProductTitle),
        productPrice: req.body.frmProductPrice,
        productDescription: common.cleanHtml(req.body.frmProductDescription),
        productPublished: req.body.frmProductPublished,
        productTags: req.body.frmProductTags,
        productOptions: common.cleanHtml(req.body.productOptJson),
        productComment: common.checkboxBool(req.body.frmProductComment),
        productAddedDate: new Date(),
        productStock: req.body.frmProductStock ? parseInt(req.body.frmProductStock) : null
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
            req.session.productComment = common.checkboxBool(req.body.frmProductComment);
            req.session.productTags = req.body.frmProductTags;
            req.session.productStock = req.body.frmProductStock ? parseInt(req.body.frmProductStock) : null;

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
                    req.session.productComment = common.checkboxBool(req.body.frmProductComment);
                    req.session.productTags = req.body.frmProductTags;
                    req.session.productStock = req.body.frmProductStock ? parseInt(req.body.frmProductStock) : null;

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
router.get('/admin/product/edit/:id', common.restrict, common.checkAccess, (req, res) => {
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
                config: req.app.config,
                editor: true,
                helpers: req.handlebars.helpers
            });
        });
    });
});

// Update an existing product form action
router.post('/admin/product/update', common.restrict, common.checkAccess, (req, res) => {
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
                req.session.productComment = common.checkboxBool(req.body.frmProductComment);
                req.session.productStock = req.body.frmProductStock ? req.body.frmProductStock : null;

                // redirect to insert
                res.redirect('/admin/product/edit/' + req.body.frmProductId);
            }else{
                common.getImages(req.body.frmProductId, req, res, (images) => {
                    let productDoc = {
                        productTitle: common.cleanHtml(req.body.frmProductTitle),
                        productDescription: common.cleanHtml(req.body.frmProductDescription),
                        productPublished: req.body.frmProductPublished,
                        productPrice: req.body.frmProductPrice,
                        productPermalink: req.body.frmProductPermalink,
                        productTags: common.cleanHtml(req.body.frmProductTags),
                        productOptions: common.cleanHtml(req.body.productOptJson),
                        productComment: common.checkboxBool(req.body.frmProductComment),
                        productStock: req.body.frmProductStock ? parseInt(req.body.frmProductStock) : null
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
router.get('/admin/product/delete/:id', common.restrict, common.checkAccess, (req, res) => {
    const db = req.app.db;

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

// update the published state based on an ajax call from the frontend
router.post('/admin/product/published_state', common.restrict, common.checkAccess, (req, res) => {
    const db = req.app.db;

    db.products.update({_id: common.getId(req.body.id)}, {$set: {productPublished: req.body.state}}, {multi: false}, (err, numReplaced) => {
        if(err){
            console.error(colors.red('Failed to update the published state: ' + err));
            res.status(400).json('Published state not updated');
        }else{
            res.status(200).json('Published state updated');
        }
    });
});

// set as main product image
router.post('/admin/product/setasmainimage', common.restrict, common.checkAccess, (req, res) => {
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
router.post('/admin/product/deleteimage', common.restrict, common.checkAccess, (req, res) => {
    const db = req.app.db;

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

module.exports = router;
