const test = require('ava');
const fs = require('fs');
const _ = require('lodash');
const app = require('../app');
const { runIndexing, fixProductDates } = require('../lib/indexing');
const session = require('supertest-session');

// Get test data to compare in tests
const rawTestData = fs.readFileSync('./bin/testdata.json', 'utf-8');
const jsonData = JSON.parse(rawTestData);

// Setup some global DB objects for comparison
let db;
let config;
let products;
let customers;
let users;
let request = null;

function setup(db){
    return Promise.all([
        db.cart.remove({}, {}),
        db.users.remove({}, {}),
        db.customers.remove({}, {}),
        db.products.remove({}, {}),
        db.orders.remove({}, {})
    ])
    .then(() => {
        return Promise.all([
            db.users.insertMany(jsonData.users),
            db.customers.insertMany(jsonData.customers),
            db.products.insertMany(fixProductDates(jsonData.products))
        ]);
    });
}

// Start up app and wait for it to be ready
test.before(async () => {
    // Create a session
    request = session(app);
    await new Promise(resolve => {
        app.on('appStarted', async () => {
            // Set some stuff now we have the app started
            config = app.config;
            db = app.db;

            await setup(db);

            // Get some data from DB to use in compares
            products = await db.products.find({}).toArray();
            customers = await db.customers.find({}).toArray();
            users = await db.users.find({}).toArray();

            // Insert orders using product ID's
            _(jsonData.orders).each(async (order) => {
                order.orderProducts.push({
                    productId: products[0]._id,
                    title: products[0].productTitle,
                    quantity: 1,
                    totalItemPrice: products[0].productPrice,
                    options: {
                        size: '7.5'
                    },
                    productImage: products[0].productImage,
                    productComment: null
                });
                order.orderDate = new Date();
                await db.orders.insert(order);
            });

            // Index everything
            await runIndexing(app);

            resolve();
        });
    });
});

test.serial('[Success] Get products JSON', async t => {
    const res = await request
        .get('?json=true')
        .expect(200);
    if(res.body.length < config.productsPerPage){
        t.is(res.body.length, products.length);
    }else{
        t.is(res.body.length, config.productsPerPage);
    }
});

test.serial('[Success] User Login', async t => {
    const res = await request
        .post('/admin/login_action')
        .send({
            email: users[0].userEmail,
            password: 'test'
        })
        .expect(200);
    t.deepEqual(res.body.message, 'Login successful');
});

test.serial('[Success] Create API key', async t => {
    const res = await request
        .post('/admin/createApiKey')
        .expect(200);

    users[0].apiKey = res.body.apiKey;
    t.deepEqual(res.body.message, 'API Key generated');
    t.deepEqual(res.body.apiKey.length, 24);
});

test.serial('[Fail] Incorrect user password', async t => {
    const res = await request
        .post('/admin/login_action')
        .send({
            email: users[0].userEmail,
            password: 'test1'
        })
        .expect(400);
    t.deepEqual(res.body.message, 'Access denied. Check password and try again.');
});

test.serial('[Fail] Customer login with incorrect email', async t => {
    const res = await request
        .post('/customer/login_action')
        .send({
            loginEmail: 'test1@test.com',
            loginPassword: 'test'
        })
        .expect(400);
    t.deepEqual(res.body.message, 'A customer with that email does not exist.');
});

test.serial('[Success] Customer login with correct email', async t => {
    const res = await request
        .post('/customer/login_action')
        .send({
            loginEmail: customers[0].email,
            loginPassword: 'test'
        })
        .expect(200);
    t.deepEqual(res.body.message, 'Successfully logged in');
});

test.serial('[Success] Add product to cart', async t => {
    const res = await request
        .post('/product/addtocart')
        .send({
            productId: products[0]._id,
            productQuantity: 1,
            productOptions: JSON.stringify(products[0].productOptions)
        })
        .expect(200);
    const sessions = await db.cart.find({}).toArray();
    if(!sessions || sessions.length === 0){
        t.fail();
    }
    t.deepEqual(res.body.message, 'Cart successfully updated');
});

test.serial('[Fail] Add product to cart with not enough stock', async t => {
    const res = await request
        .post('/product/addtocart')
        .send({
            productId: products[0]._id,
            productQuantity: 100,
            productOptions: JSON.stringify(products[0].productOptions)
        })
        .expect(400);
    t.deepEqual(res.body.message, 'There is insufficient stock of this product.');
});

test.serial('[Fail] Add incorrect product to cart', async t => {
    const res = await request
        .post('/product/addtocart')
        .send({
            id: 'fake_product_id',
            state: false
        })
        .expect(400);
    t.deepEqual(res.body.message, 'Error updating cart. Please try again.');
});

test.serial('[Success] Remove item previously added to cart', async t => {
    const res = await request
        .post('/product/removefromcart')
        .send({
            cartId: products[0]._id
        })
        .expect(200);
    t.deepEqual(res.body.message, 'Product successfully removed');
});

test.serial('[Fail] Try remove an item which is not in the cart', async t => {
    const res = await request
        .post('/product/removefromcart')
        .send({
            cartId: 'bogus_product_id'
        })
        .expect(400);
    t.deepEqual(res.body.message, 'Product not found in cart');
});

test.serial('[Success] Search products', async t => {
    const res = await request
        .get('/category/backpack?json=true')
        .expect(200);

    // Should be two backpack products
    t.deepEqual(res.body.length, 2);
});

test.serial('[Success] Check for sitemap.xml', async t => {
    const res = await request
        .get('/sitemap.xml')
        .expect(200);

    if(!res.text){
        t.fail();
    }

    // Document should start with XML tag
    t.deepEqual(res.text.substring(0, 5), '<?xml');
});

test.serial('[Success] Create a customer', async t => {
    const customer = {
        email: 'sarah.jones@test.com',
        firstName: 'Sarah',
        lastName: 'Jones',
        address1: '1 Sydney Street',
        address2: '',
        country: 'Australia',
        state: 'NSW',
        postcode: '2000',
        phone: '0400000000',
        password: 'password'
    };

    const res = await request
        .post('/customer/create')
        .send(customer)
        .expect(200);

    t.deepEqual(res.body.message, 'Successfully logged in');
});

test.serial('[Success] Get orders', async t => {
    const res = await request
        .get('/admin/orders')
        .set('apiKey', users[0].apiKey)
        .expect(200);

    // Check the returned order length
    t.deepEqual(jsonData.orders.length, res.body.orders.length);
});

test.serial('[Fail] Try get orders with a bogus apiKey', async t => {
    const res = await request
        .get('/admin/orders')
        .set('apiKey', '123456789012345678901234')
        .expect(400);

    t.deepEqual(res.body.message, 'Access denied');
});

test.serial('[Success] Get orders by <Paid> status', async t => {
    const res = await request
        .get('/admin/orders/bystatus/Paid')
        .set('apiKey', users[0].apiKey)
        .expect(200);

    // Check the returned order length
    t.deepEqual(1, res.body.orders.length);
});

test.serial('[Success] Filter orders', async t => {
    const res = await request
        .get('/admin/orders/filter/Cles')
        .set('apiKey', users[0].apiKey)
        .expect(200);

    // Check the returned order length
    t.deepEqual(2, res.body.orders.length);
});

test.serial('[Fail] Try create a duplicate customer', async t => {
    const customer = {
        email: 'sarah.jones@test.com',
        firstName: 'Sarah',
        lastName: 'Jones',
        address1: '1 Sydney Street',
        address2: '',
        country: 'Australia',
        state: 'NSW',
        postcode: '2000',
        phone: '0400000000',
        password: 'password'
    };

    const res = await request
        .post('/customer/create')
        .send(customer)
        .expect(400);

    t.deepEqual(res.body.err, 'A customer already exists with that email address');
});

test.serial('[Success] Get customer list', async t => {
    const res = await request
        .get('/admin/customers')
        .set('apiKey', users[0].apiKey)
        .expect(200);

    // Check the returned customers length
    t.deepEqual(2, res.body.length);
});

test.serial('[Success] Filter customers', async t => {
    const res = await request
        .get('/admin/customers')
        .set('apiKey', users[0].apiKey)
        .expect(200);

    // Check the returned customers length
    t.deepEqual(2, res.body.length);
});

test.serial('[Success] Get single customer', async t => {
    const res = await request
        .get('/admin/customer/view/' + customers[0]._id)
        .set('apiKey', users[0].apiKey)
        .expect(200);

    // Check the returned customer matches ID
    t.deepEqual(customers[0]._id.toString(), res.body._id);
});

test.serial('[Success] Add a product', async t => {
    const product = {
        productPermalink: 'test-jacket',
        productTitle: 'Test Jacket',
        productPrice: 100,
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
        productComment: 'test comment',
        productStock: 50
    };

    const res = await request
        .post('/admin/product/insert')
        .send(product)
        .set('apiKey', users[0].apiKey)
        .expect(200);

    // Check the returned message
    t.deepEqual(res.body.message, 'New product successfully created');
});

test.serial('[Success] Update a product', async t => {
    const product = {
        productId: products[0]._id,
        productTitle: 'Test Jacket',
        productPrice: 200,
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
        productComment: 'test comment',
        productStock: 50
    };

    const res = await request
        .post('/admin/product/update')
        .send(product)
        .set('apiKey', users[0].apiKey)
        .expect(200);

    // Check the returned message
    t.deepEqual(res.body.message, 'Successfully saved');
    t.deepEqual(res.body.product.productTitle, product.productTitle);
    t.deepEqual(res.body.product.productPrice, product.productPrice);
});
