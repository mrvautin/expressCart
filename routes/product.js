const express = require('express');
const { restrict, checkAccess } = require('../lib/auth');
const {
    getId,
    clearSessionValue,
    cleanHtml,
    convertBool,
    checkboxBool,
    safeParseInt,
    getImages
} = require('../lib/common');
const { indexProducts } = require('../lib/indexing');
const { validateJson } = require('../lib/schema');
const { paginateData } = require('../lib/paginate');
const colors = require('colors');
const rimraf = require('rimraf');
const fs = require('fs');
const path = require('path');
const router = express.Router();

router.get('/admin/products/:page?', restrict, async (req, res, next) => {
    let pageNum = 1;
    if(req.params.page){
        pageNum = req.params.page;
    }

    // Get our paginated data
    const products = await paginateData(false, req, pageNum, 'products', {}, { productAddedDate: -1 });

    res.render('products', {
        title: 'Cart - Products',
        results: products.data,
        totalItemCount: products.totalItems,
        pageNum,
        paginateUrl: 'admin/products',
        resultType: 'top',
        session: req.session,
        admin: true,
        config: req.app.config,
        message: clearSessionValue(req.session, 'message'),
        messageType: clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers
    });
});

router.get('/admin/products/filter/:search', restrict, async (req, res, next) => {
    const db = req.app.db;
    const searchTerm = req.params.search;
    const productsIndex = req.app.productsIndex;

    const lunrIdArray = [];
    productsIndex.search(searchTerm).forEach((id) => {
        lunrIdArray.push(getId(id.ref));
    });

    // we search on the lunr indexes
    const results = await db.products.find({ _id: { $in: lunrIdArray } }).toArray();

    if(req.apiAuthenticated){
        res.status(200).json(results);
        return;
    }

    res.render('products', {
        title: 'Results',
        results: results,
        resultType: 'filtered',
        admin: true,
        config: req.app.config,
        session: req.session,
        searchTerm: searchTerm,
        message: clearSessionValue(req.session, 'message'),
        messageType: clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers
    });
});

// insert form
router.get('/admin/product/new', restrict, checkAccess, (req, res) => {
    res.render('product-new', {
        title: 'New product',
        session: req.session,
        productTitle: clearSessionValue(req.session, 'productTitle'),
        productDescription: clearSessionValue(req.session, 'productDescription'),
        productPrice: clearSessionValue(req.session, 'productPrice'),
        productPermalink: clearSessionValue(req.session, 'productPermalink'),
        message: clearSessionValue(req.session, 'message'),
        messageType: clearSessionValue(req.session, 'messageType'),
        editor: true,
        admin: true,
        helpers: req.handlebars.helpers,
        config: req.app.config
    });
});

// insert new product form action
router.post('/admin/product/insert', restrict, checkAccess, async (req, res) => {
    const db = req.app.db;

    const doc = {
        productPermalink: req.body.productPermalink,
        productTitle: cleanHtml(req.body.productTitle),
        productPrice: req.body.productPrice,
        productDescription: cleanHtml(req.body.productDescription),
        productGtin: cleanHtml(req.body.productGtin),
        productBrand: cleanHtml(req.body.productBrand),
        productPublished: convertBool(req.body.productPublished),
        productTags: req.body.productTags,
        productComment: checkboxBool(req.body.productComment),
        productAddedDate: new Date(),
        productStock: safeParseInt(req.body.productStock) || null,
        productStockDisable: convertBool(req.body.productStockDisable),
        productSubscription: cleanHtml(req.body.productSubscription)
    };

    // Validate the body again schema
    const schemaValidate = validateJson('newProduct', doc);
    if(!schemaValidate.result){
        if(process.env.NODE_ENV !== 'test'){
            console.log('schemaValidate errors', schemaValidate.errors);
        }
        res.status(400).json(schemaValidate.errors);
        return;
    }

    // Check permalink doesn't already exist
    const product = await db.products.countDocuments({ productPermalink: req.body.productPermalink });
    if(product > 0 && req.body.productPermalink !== ''){
        res.status(400).json({ message: 'Permalink already exists. Pick a new one.' });
        return;
    }

    try{
        const newDoc = await db.products.insertOne(doc);
        // get the new ID
        const newId = newDoc.insertedId;

        // add to lunr index
        indexProducts(req.app)
        .then(() => {
            res.status(200).json({
                message: 'New product successfully created',
                productId: newId
            });
        });
    }catch(ex){
        console.log(colors.red(`Error inserting document: ${ex}`));
        res.status(400).json({ message: 'Error inserting document' });
    }
});

// render the editor
router.get('/admin/product/edit/:id', restrict, checkAccess, async (req, res) => {
    const db = req.app.db;

    const images = await getImages(req.params.id, req, res);
    const product = await db.products.findOne({ _id: getId(req.params.id) });
    if(!product){
        // If API request, return json
        if(req.apiAuthenticated){
            res.status(400).json({ message: 'Product not found' });
            return;
        }
        req.session.message = 'Product not found';
        req.session.messageType = 'danger';
        res.redirect('/admin/products');
        return;
    }

    // Get variants
    product.variants = await db.variants.find({ product: getId(req.params.id) }).toArray();

    // If API request, return json
    if(req.apiAuthenticated){
        res.status(200).json(product);
        return;
    }

    res.render('product-edit', {
        title: 'Edit product',
        result: product,
        images: images,
        admin: true,
        session: req.session,
        message: clearSessionValue(req.session, 'message'),
        messageType: clearSessionValue(req.session, 'messageType'),
        config: req.app.config,
        editor: true,
        helpers: req.handlebars.helpers
    });
});

// Add a variant to a product
router.post('/admin/product/addvariant', restrict, checkAccess, async (req, res) => {
    const db = req.app.db;

    const variantDoc = {
        product: req.body.product,
        title: req.body.title,
        price: req.body.price,
        stock: safeParseInt(req.body.stock) || null
    };

    // Validate the body again schema
    const schemaValidate = validateJson('newVariant', variantDoc);
    if(!schemaValidate.result){
        if(process.env.NODE_ENV !== 'test'){
            console.log('schemaValidate errors', schemaValidate.errors);
        }
        res.status(400).json(schemaValidate.errors);
        return;
    }

    // Check product exists
    const product = await db.products.findOne({ _id: getId(req.body.product) });

    if(!product){
        console.log('here1?');
        res.status(400).json({ message: 'Failed to add product variant' });
        return;
    }

    // Fix values
    variantDoc.product = getId(req.body.product);
    variantDoc.added = new Date();

    try{
        const variant = await db.variants.insertOne(variantDoc);
        product.variants = variant.ops;
        res.status(200).json({ message: 'Successfully added variant', product });
    }catch(ex){
        console.log('here?');
        res.status(400).json({ message: 'Failed to add variant. Please try again' });
    }
});

// Update an existing product variant
router.post('/admin/product/editvariant', restrict, checkAccess, async (req, res) => {
    const db = req.app.db;

    const variantDoc = {
        product: req.body.product,
        variant: req.body.variant,
        title: req.body.title,
        price: req.body.price,
        stock: safeParseInt(req.body.stock) || null
    };

    // Validate the body again schema
    const schemaValidate = validateJson('editVariant', variantDoc);
    if(!schemaValidate.result){
        if(process.env.NODE_ENV !== 'test'){
            console.log('schemaValidate errors', schemaValidate.errors);
        }
        res.status(400).json(schemaValidate.errors);
        return;
    }

    // Validate ID's
    const product = await db.products.findOne({ _id: getId(req.body.product) });
    if(!product){
        res.status(400).json({ message: 'Failed to add product variant' });
        return;
    }

    const variant = await db.variants.findOne({ _id: getId(req.body.variant) });
    if(!variant){
        res.status(400).json({ message: 'Failed to add product variant' });
        return;
    }

    // Removed props not needed
    delete variantDoc.product;
    delete variantDoc.variant;

    try{
        const updatedVariant = await db.variants.findOneAndUpdate({
            _id: getId(req.body.variant)
        }, {
            $set: variantDoc
        }, {
            returnOriginal: false
        });
        res.status(200).json({ message: 'Successfully saved variant', variant: updatedVariant.value });
    }catch(ex){
        res.status(400).json({ message: 'Failed to save variant. Please try again' });
    }
});

// Remove a product variant
router.post('/admin/product/removevariant', restrict, checkAccess, async (req, res) => {
    const db = req.app.db;

    const variant = await db.variants.findOne({ _id: getId(req.body.variant) });
    if(!variant){
        res.status(400).json({ message: 'Failed to remove product variant' });
        return;
    }

    try{
        // Delete the variant
        await db.variants.deleteOne({ _id: variant._id }, {});
        res.status(200).json({ message: 'Successfully removed variant' });
    }catch(ex){
        res.status(400).json({ message: 'Failed to remove variant. Please try again' });
    }
});

// Update an existing product form action
router.post('/admin/product/update', restrict, checkAccess, async (req, res) => {
    const db = req.app.db;

    const product = await db.products.findOne({ _id: getId(req.body.productId) });

    if(!product){
        res.status(400).json({ message: 'Failed to update product' });
        return;
    }
    const count = await db.products.countDocuments({ productPermalink: req.body.productPermalink, _id: { $ne: getId(product._id) } });
    if(count > 0 && req.body.productPermalink !== ''){
        res.status(400).json({ message: 'Permalink already exists. Pick a new one.' });
        return;
    }

    const images = await getImages(req.body.productId, req, res);
    const productDoc = {
        productId: req.body.productId,
        productPermalink: req.body.productPermalink,
        productTitle: cleanHtml(req.body.productTitle),
        productPrice: req.body.productPrice,
        productDescription: cleanHtml(req.body.productDescription),
        productGtin: cleanHtml(req.body.productGtin),
        productBrand: cleanHtml(req.body.productBrand),
        productPublished: convertBool(req.body.productPublished),
        productTags: req.body.productTags,
        productComment: checkboxBool(req.body.productComment),
        productStock: safeParseInt(req.body.productStock) || null,
        productStockDisable: convertBool(req.body.productStockDisable),
        productSubscription: cleanHtml(req.body.productSubscription)
    };

    // Validate the body again schema
    const schemaValidate = validateJson('editProduct', productDoc);
    if(!schemaValidate.result){
        res.status(400).json(schemaValidate.errors);
        return;
    }

    // Remove productId from doc
    delete productDoc.productId;

    // if no featured image
    if(!product.productImage){
        if(images.length > 0){
            productDoc.productImage = images[0].path;
        }else{
            productDoc.productImage = '/uploads/placeholder.png';
        }
    }else{
        productDoc.productImage = product.productImage;
    }

    try{
        await db.products.updateOne({ _id: getId(req.body.productId) }, { $set: productDoc }, {});
        // Update the index
        indexProducts(req.app)
        .then(() => {
            res.status(200).json({ message: 'Successfully saved', product: productDoc });
        });
    }catch(ex){
        res.status(400).json({ message: 'Failed to save. Please try again' });
    }
});

// delete a product
router.post('/admin/product/delete', restrict, checkAccess, async (req, res) => {
    const db = req.app.db;

    // remove the product
    await db.products.deleteOne({ _id: getId(req.body.productId) }, {});

    // Remove the variants
    await db.variants.deleteMany({ product: getId(req.body.productId) }, {});

    // delete any images and folder
    rimraf(`public/uploads/${req.body.productId}`, (err) => {
        if(err){
            console.info(err.stack);
            res.status(400).json({ message: 'Failed to delete product' });
        }

        // re-index products
        indexProducts(req.app)
        .then(() => {
            res.status(200).json({ message: 'Product successfully deleted' });
        });
    });
});

// update the published state based on an ajax call from the frontend
router.post('/admin/product/publishedState', restrict, checkAccess, async (req, res) => {
    const db = req.app.db;

    try{
        await db.products.updateOne({ _id: getId(req.body.id) }, { $set: { productPublished: convertBool(req.body.state) } }, { multi: false });
        res.status(200).json({ message: 'Published state updated' });
    }catch(ex){
        console.error(colors.red(`Failed to update the published state: ${ex}`));
        res.status(400).json({ message: 'Published state not updated' });
    }
});

// set as main product image
router.post('/admin/product/setasmainimage', restrict, checkAccess, async (req, res) => {
    const db = req.app.db;

    try{
        // update the productImage to the db
        await db.products.updateOne({ _id: getId(req.body.product_id) }, { $set: { productImage: req.body.productImage } }, { multi: false });
        res.status(200).json({ message: 'Main image successfully set' });
    }catch(ex){
        res.status(400).json({ message: 'Unable to set as main image. Please try again.' });
    }
});

// deletes a product image
router.post('/admin/product/deleteimage', restrict, checkAccess, async (req, res) => {
    const db = req.app.db;

    // get the productImage from the db
    const product = await db.products.findOne({ _id: getId(req.body.product_id) });
    if(!product){
        res.status(400).json({ message: 'Product not found' });
        return;
    }
    // Check for main image being deleted
    if(req.body.productImage === product.productImage){
        // set the productImage to null
        await db.products.updateOne({ _id: getId(req.body.product_id) }, { $set: { productImage: null } }, { multi: false });
    }

    // Check if image is a URL
    if(req.body.productImage.substring(0, 4) === 'http'){
        // Remove image URL from list
        const imageList = product.productImages.filter((item) => item !== req.body.productImage);
        // Update image list to DB
        await db.products.updateOne({ _id: getId(req.body.product_id) }, { $set: { productImages: imageList } }, { multi: false });
        res.status(200).json({ message: 'Image successfully deleted' });
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

module.exports = router;
