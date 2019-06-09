const test = require('ava');
const fs = require('fs');
const app = require('../app');
const common = require('../lib/common');
const request = require('supertest');
const agent = request.agent(app);

// Get test data to compare in tests
const rawTestData = fs.readFileSync('./bin/testdata.json', 'utf-8');
const jsonData = JSON.parse(rawTestData);

// Setup some global DB objects for comparison
let db;
let config;
let products;
let customers;
let users;

function setup(db){
    return Promise.all([
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
            db.menu.insertOne(jsonData.menu)
        ]);
    });
}

// Start up app and wait for it to be ready
test.before(async () => {
    return await new Promise(resolve => {
        app.on('appStarted', async () => {
            // Set some stuff now we have the app started
            config = app.config;
            db = app.db;

            await setup(db);

            // Get some data from DB to use in compares
            products = await db.products.find({}).toArray();
            customers = await db.customers.find({}).toArray();
            users = await db.users.find({}).toArray();
            resolve();
        });
    });
});

test.serial('[Success] Get products JSON', async t => {
    const res = await request(app)
        .get('?json=true')
        .expect(200)
    if(res.body.length < config.productsPerPage){
        t.is(res.body.length, testData.products.length);
    }else{
        t.is(res.body.length, config.productsPerPage);
    }
});

test.serial('[Success] User Login', async t => {
    const res = await request(app)
        .post('/admin/login_action')
        .send({
            email: users[0].userEmail,
            password: 'test'
        })
        .expect(200)
    t.deepEqual(res.body.message, 'Login successful');
});

test.serial('[Fail] Incorrect user password', async t => {
    const res = await request(app)
        .post('/admin/login_action')
        .send({
            email: users[0].userEmail,
            password: 'test1'
        })
        .expect(400)
    
    t.deepEqual(res.body.message, 'Access denied. Check password and try again.');
});

test.serial('[Fail] Customer login with incorrect email', async t => {
    const res = await request(app)
        .post('/customer/login_action')
        .send({
            loginEmail: 'test1@test.com',
            loginPassword: 'test'
        })
        .expect(400)
        
    t.deepEqual(res.body.message, 'A customer with that email does not exist.');
});

test.serial('[Success] Customer login with correct email', async t => {
    const res = await request(app)
        .post('/customer/login_action')
        .send({
            loginEmail: customers[0].email,
            loginPassword: 'test'
        })
        .expect(200)
    
    t.deepEqual(res.body.message, 'Successfully logged in');
});

test.serial('[Success] Add product to cart', async t => {
    const res = await request(app)
        .post('/product/addtocart')
        .send({
            productId: products[0]._id,
            productQuantity: 1,
            productOptions: JSON.stringify(products[0].productOptions)
        })
        .expect(200)
        
    t.deepEqual(res.body.message, 'Cart successfully updated');
});

test.serial('[Fail] Add incorrect product to cart', async t => {
    const res = await request(app)
        .post('/product/addtocart')
        .send({
            id: 'fake_product_id',
            state: false
        })
        .expect(400)
        
    t.deepEqual(res.body.message, 'Error updating cart. Please try again.');
});
