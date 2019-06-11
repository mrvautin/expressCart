const test = require('ava');
const fs = require('fs');
const app = require('../app');
const common = require('../lib/common');
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

function setup(db, app){
    return Promise.all([
        db.cart.remove({}, {}),
        db.users.remove({}, {}),
        db.customers.remove({}, {}),
        db.products.remove({}, {}),
        db.menu.remove({}, {})
    ])
    .then(() => {
        return Promise.all([
            db.users.insertMany(jsonData.users),
            db.customers.insertMany(jsonData.customers),
            db.products.insertMany(common.fixProductDates(jsonData.products)),
            db.menu.insertOne(jsonData.menu),
            common.runIndexing(app)
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

            await setup(db, app);

            // Get some data from DB to use in compares
            products = await db.products.find({}).toArray();
            customers = await db.customers.find({}).toArray();
            users = await db.users.find({}).toArray();
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
