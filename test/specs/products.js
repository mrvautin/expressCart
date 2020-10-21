const {
    serial: test
} = require('ava');
const {
    runBefore,
    g
} = require('../helper');

test.before(async () => {
    await runBefore();
});

test('[Success] Get products JSON', async t => {
    const res = await g.request
        .get('?json=true')
        .expect(200);
    if(res.body.length < g.config.productsPerPage){
        t.is(res.body.length, g.products.length);
    }else{
        t.is(res.body.length, g.config.productsPerPage);
    }
});

test('[Success] Search products', async t => {
    const res = await g.request
        .get('/category/backpack?json=true')
        .expect(200);

    // Should be two backpack products
    t.deepEqual(res.body.length, 2);
});

test('[Success] Filter products', async t => {
    const res = await g.request
        .get('/admin/products/filter/backpack')
        .set('apiKey', g.users[0].apiKey)
        .expect(200);

    // Should be two backpack products
    t.deepEqual(res.body.length, 2);
});

test('[Success] Edit a product', async t => {
    const res = await g.request
        .get(`/admin/product/edit/${g.products[0]._id}`)
        .set('apiKey', g.users[0].apiKey)
        .expect(200);

    // Products should match
    t.deepEqual(res.body._id.toString(), g.products[0]._id.toString());
    t.deepEqual(res.body.productPermalink, g.products[0].productPermalink);
});

test('[Fail] Edit an invalid product', async t => {
    const res = await g.request
        .get('/admin/product/edit/some_invalid_product')
        .set('apiKey', g.users[0].apiKey)
        .expect(400);

    // Check the returned message
    t.deepEqual(res.body.message, 'Product not found');
});

test('[Success] Add a product', async t => {
    const product = {
        productPermalink: 'test-jacket',
        productTitle: 'Test Jacket',
        productPrice: '100.00',
        productDescription: 'Test product description used to describe the product',
        productPublished: true,
        productTags: 'organic, jacket',
        productComment: false,
        productStock: 50
    };

    const res = await g.request
        .post('/admin/product/insert')
        .send(product)
        .set('apiKey', g.users[0].apiKey)
        .expect(200);

    // Check the returned message
    t.deepEqual(res.body.message, 'New product successfully created');
});

test('[Success] Add a product with incorrect GTIN', async t => {
    const product = {
        productPermalink: 'test-jacket-invalid-gtin',
        productTitle: 'Test Jacket',
        productPrice: '100.00',
        productDescription: 'Test product description used to describe the product',
        productBrand: 'Test brand',
        productGtin: 'should be alpha',
        productPublished: true,
        productTags: 'organic, jacket',
        productComment: false,
        productStock: 50
    };

    const res = await g.request
        .post('/admin/product/insert')
        .send(product)
        .set('apiKey', g.users[0].apiKey)
        .expect(400);

    // Check the returned message
    t.deepEqual(res.body[0].message, 'should match format "alphanumeric"');
});

test('[Fail] Add a product - Duplicate permalink', async t => {
    const product = {
        productPermalink: 'test-jacket',
        productTitle: 'Test Jacket - blue',
        productPrice: '100.00',
        productDescription: 'Test product description used to describe the product',
        productBrand: 'Test brand',
        productPublished: true,
        productTags: 'organic, jacket, blue',
        productComment: false,
        productStock: 50
    };

    const res = await g.request
        .post('/admin/product/insert')
        .send(product)
        .set('apiKey', g.users[0].apiKey)
        .expect(400);

    // Check the returned message
    t.deepEqual(res.body.message, 'Permalink already exists. Pick a new one.');
});

test('[Success] Update a product', async t => {
    const product = {
        productId: g.products[0]._id,
        productTitle: 'Test Jacket',
        productPrice: '200.00',
        productDescription: 'Test product description used to describe the product',
        productBrand: 'Test brand',
        productPublished: true,
        productTags: 'organic, jacket',
        productComment: true,
        productStock: 50
    };

    const res = await g.request
        .post('/admin/product/update')
        .send(product)
        .set('apiKey', g.users[0].apiKey)
        .expect(200);

    // Check the returned message
    t.deepEqual(res.body.message, 'Successfully saved');
    t.deepEqual(res.body.product.productTitle, product.productTitle);
    t.deepEqual(res.body.product.productPrice, product.productPrice);
});

test('[Fail] Update a product - Duplicate permalink', async t => {
    const product = {
        productId: g.products[0]._id,
        productPermalink: 'test-jacket'
    };

    const res = await g.request
        .post('/admin/product/update')
        .send(product)
        .set('apiKey', g.users[0].apiKey)
        .expect(400);

    // Check the returned message
    t.deepEqual(res.body.message, 'Permalink already exists. Pick a new one.');
});

test('[Success] Delete a product', async t => {
    const res = await g.request
        .post('/admin/product/delete')
        .send({ productId: g.products[0]._id })
        .set('apiKey', g.users[0].apiKey)
        .expect(200);

    // Check the returned message
    t.deepEqual(res.body.message, 'Product successfully deleted');
});
