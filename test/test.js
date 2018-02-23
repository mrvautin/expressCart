const test = require('ava');
const fs = require('fs');
const app = require('../app');
const common = require('../lib/common');
const request = require('supertest');
const agent = request.agent(app);

// Get test data to compare in tests
const rawTestData = fs.readFileSync('./bin/testdata.json', 'utf-8');
const testData = JSON.parse(rawTestData);

// Setup some global DB objects for comparison
let db;
let config;
let products;
let customers;
let users;

// Start up app and wait for it to be ready
test.before.cb(t => {
    app.on('appStarted', async () => {
        // Set some stuff now we have the app started
        config = app.config;
        db = app.db;

        // Get some data from DB to use in compares
        await common.testData(app);
        products = await db.products.find({}).toArray();
        customers = await db.customers.find({}).toArray();
        users = await db.users.find({}).toArray();
        agent
            .post('/admin/login_action')
            .send({
                email: users[0].userEmail,
                password: 'test'
            })
            .expect(200)
            .end((err, res) => {
                if(err){
                    t.fail();
                    t.end();
                }
                t.end();
            });
    });
});

test.cb('[Success] Get products JSON', t => {
    agent
        .get('?json=true')
        .expect(200)
        .end((err, res) => {
            if(err){
                t.fail();
                t.end();
            }

            if(res.body.length < config.productsPerPage){
                t.is(res.body.length, testData.products.length);
            }else{
                t.is(res.body.length, config.productsPerPage);
            }
            t.pass();
            t.end();
        });
});

test.cb('[Success] User Login', t => {
    agent
        .post('/admin/login_action')
        .send({
            email: users[0].userEmail,
            password: 'test'
        })
        .expect(200)
        .end((err, res) => {
            if(err){
                t.fail();
                t.end();
            }

            t.deepEqual(res.body.message, 'Login successful');
            t.end();
        });
});

test.cb('[Fail] Incorrect user password', t => {
    agent
        .post('/admin/login_action')
        .send({
            email: users[0].userEmail,
            password: 'test1'
        })
        .expect(400)
        .end((err, res) => {
            if(err){
                t.fail();
                t.end();
            }

            t.deepEqual(res.body.message, 'Access denied. Check password and try again.');
            t.end();
        });
});

test.cb('[Fail] Customer login with incorrect email', t => {
    agent
        .post('/customer/login_action')
        .send({
            loginEmail: 'test1@test.com',
            loginPassword: 'test'
        })
        .expect(400)
        .end((err, res) => {
            if(err){
                t.fail();
                t.end();
            }

            t.deepEqual(res.body.message, 'A customer with that email does not exist.');
            t.end();
        });
});

test.cb('[Success] Customer login with correct email', t => {
    agent
        .post('/customer/login_action')
        .send({
            loginEmail: 'test@test.com',
            loginPassword: 'test'
        })
        .expect(200)
        .end((err, res) => {
            if(err){
                t.fail();
                t.end();
            }

            t.deepEqual(res.body.message, 'Successfully logged in');
            t.end();
        });
});

test.cb('[Success] Add product to cart', t => {
    agent
        .post('/product/addtocart')
        .send({
            productId: products[0]._id,
            productQuantity: 1,
            productOptions: JSON.stringify(products[0].productOptions)
        })
        .expect(200)
        .end((err, res) => {
            if(err){
                t.fail();
                t.end();
            }

            t.deepEqual(res.body.message, 'Cart successfully updated');
            t.end();
        });
});

test.cb('[Fail] Add incorrect product to cart', t => {
    agent
        .post('/product/addtocart')
        .send({
            id: 'fake_product_id',
            state: false
        })
        .expect(400)
        .end((err, res) => {
            if(err){
                t.fail();
                t.end();
            }
            t.deepEqual(res.body.message, 'Error updating cart. Please try again.');
            t.end();
        });
});

test.cb('[Sucess] Change product publish status', t => {
    agent
        .post('/admin/product/published_state')
        .send({
            id: products[0]._id,
            state: false
        })
        .expect(200)
        .end((err, res) => {
            if(err){
                t.fail();
                t.end();
            }
            t.end();
        });
});
