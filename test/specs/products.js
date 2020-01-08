import{ serial as test }from'ava';
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

test('[Success] Add subscripton product to cart', async t => {
    const res = await g.request
        .post('/product/addtocart')
        .send({
            productId: g.products[7]._id,
            productQuantity: 1,
            productOptions: {}
        })
        .expect(200);
    const sessions = await g.db.cart.find({}).toArray();
    if(!sessions || sessions.length === 0){
        t.fail();
    }
    t.deepEqual(res.body.message, 'Cart successfully updated');
});

test('[Fail] Add product to cart when subscription already added', async t => {
    const res = await g.request
        .post('/product/addtocart')
        .send({
            productId: g.products[1]._id,
            productQuantity: 1,
            productOptions: JSON.stringify(g.products[1].productOptions)
        })
        .expect(400);
    t.deepEqual(res.body.message, 'Subscription already existing in cart. You cannot add more.');
});

test('[Fail] Add quantity which exceeds the maxQuantity', async t => {
    const res = await g.request
        .post('/product/addtocart')
        .send({
            productId: g.products[4]._id,
            productQuantity: 75,
            productOptions: {}
        })
        .expect(400);
    t.deepEqual(res.body.message, 'The quantity exceeds the max amount. Please contact us for larger orders.');
});

test('[Success] Empty cart', async t => {
    const res = await g.request
        .post('/product/emptycart')
        .expect(200);
    t.deepEqual(res.body.message, 'Cart successfully emptied');
});

test('[Success] Add product to cart', async t => {
    const res = await g.request
        .post('/product/addtocart')
        .send({
            productId: g.products[0]._id,
            productQuantity: 1,
            productOptions: JSON.stringify(g.products[0].productOptions)
        })
        .expect(200);
    const sessions = await g.db.cart.find({}).toArray();
    if(!sessions || sessions.length === 0){
        t.fail();
    }
    t.deepEqual(res.body.message, 'Cart successfully updated');
});

test('[Success] Update cart', async t => {
    const cart = await g.request
        .get('/cart/retrieve')
        .expect(200);

    const productId = g.products[0]._id;

    const res = await g.request
        .post('/product/updatecart')
        .send({
            productId: productId,
            quantity: 10
        })
        .expect(200);

    t.deepEqual(res.body.message, 'Cart successfully updated');

    const checkCart = await g.request
        .get('/cart/retrieve')
        .expect(200);

    // Check new quantity and total price has been updated
    t.deepEqual(checkCart.body.cart[productId].quantity, 10);
    t.deepEqual(checkCart.body.cart[productId].totalItemPrice, cart.body.cart[productId].totalItemPrice * 10);
});

test('[Fail] Cannot add subscripton when other product in cart', async t => {
    const res = await g.request
        .post('/product/addtocart')
        .send({
            productId: g.products[7]._id,
            productQuantity: 1,
            productOptions: {}
        })
        .expect(400);
    t.deepEqual(res.body.message, 'You cannot combine subscription products with existing in your cart. Empty your cart and try again.');
});

test('[Fail] Add product to cart with not enough stock', async t => {
    const res = await g.request
        .post('/product/addtocart')
        .send({
            productId: g.products[0]._id,
            productQuantity: 20,
            productOptions: JSON.stringify(g.products[0].productOptions)
        })
        .expect(400);
    t.deepEqual(res.body.message, 'There is insufficient stock of this product.');
});

test('[Fail] Add incorrect product to cart', async t => {
    const res = await g.request
        .post('/product/addtocart')
        .send({
            id: 'fake_product_id',
            state: false
        })
        .expect(400);
    t.deepEqual(res.body.message, 'Error updating cart. Please try again.');
});

test('[Success] Remove item previously added to cart', async t => {
    // Add a second product to cart
    await g.request
        .post('/product/addtocart')
        .send({
            productId: g.products[1]._id,
            productQuantity: 1,
            productOptions: JSON.stringify(g.products[1].productOptions)
        })
        .expect(200);

    const res = await g.request
        .post('/product/removefromcart')
        .send({
            productId: g.products[0]._id
        })
        .expect(200);
    t.deepEqual(res.body.message, 'Product successfully removed');
});

test('[Fail] Try remove an item which is not in the cart', async t => {
    const res = await g.request
        .post('/product/removefromcart')
        .send({
            cartId: 'bogus_product_id'
        })
        .expect(400);
    t.deepEqual(res.body.message, 'Product not found in cart');
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
        productDescription: 'Test desc',
        productPublished: true,
        productTags: 'organic, jacket',
        productOptions: {
            Size: {
                optName: 'Size',
                optLabel: 'Select size',
                optType: 'select',
                optOptions: ['S', 'M', 'L', 'XL']
            }
        },
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

test('[Fail] Add a product - Duplicate permalink', async t => {
    const product = {
        productPermalink: 'test-jacket',
        productTitle: 'Test Jacket - blue',
        productPrice: '100.00',
        productDescription: 'Test desc blue',
        productPublished: true,
        productTags: 'organic, jacket, blue',
        productOptions: {
            Size: {
                optName: 'Size',
                optLabel: 'Select size',
                optType: 'select',
                optOptions: ['S', 'M', 'L', 'XL']
            }
        },
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
        productDescription: 'Test desc',
        productPublished: true,
        productTags: 'organic, jacket',
        productOptions: {
            Size: {
                optName: 'Size',
                optLabel: 'Select size',
                optType: 'select',
                optOptions: ['S', 'M', 'L', 'XL']
            }
        },
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
