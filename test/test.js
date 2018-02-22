const test = require('ava');
const axios = require('axios');
const fs = require('fs');
const app = require('../app');
const common = require('../lib/common');

// Get test data to compare in tests
const rawTestData = fs.readFileSync('./bin/testdata.json', 'utf-8');
const testData = JSON.parse(rawTestData);

let config;
let db;
let baseUrl;
let products;
let customers;
let users;

// Start up app and wait for it to be ready
test.before.cb(t => {
    app.on('appStarted', async () => {
        // Set some stuff now we have the app started
        config = app.config;
        db = app.db;
        baseUrl = `http://localhost:${app.port}`;
        await common.testData(app);
        products = await db.products.find({}).toArray();
        customers = await db.customers.find({}).toArray();
        users = await db.users.find({}).toArray();
        t.end();
    });
});

test('[Success] Get products JSON', t => {
    return new Promise((resolve, reject) => {
        axios.get(`${baseUrl}?json=true`)
        .then((response) => {
            if(response.data.length < config.productsPerPage){
                t.is(response.data.length, testData.products.length);
            }else{
                t.is(response.data.length, config.productsPerPage);
            }
            t.pass();
            resolve();
        })
        .catch((error) => {
            reject(new Error('Should not be allowed'));
        });
    });
});

test('[Success] User Login', t => {
    return new Promise((resolve, reject) => {
        axios.post(`${baseUrl}/admin/login_action`, {
            email: users[0].userEmail,
            password: 'test'
        })
        .then((response) => {
            t.deepEqual(response.data.message, 'Login successful');
            resolve();
        })
        .catch((error) => {
            reject(new Error('Should not be allowed'));
        });
    });
});

test('[Fail] Incorrect user password', t => {
    return new Promise((resolve, reject) => {
        axios.post(`${baseUrl}/admin/login_action`, {
            email: users[0].userEmail,
            password: 'test1'
        })
        .then((response) => {
            reject(new Error('Should not be allowed'));
        })
        .catch((error) => {
            t.deepEqual(error.response.data.message, 'Access denied. Check password and try again.');
            resolve();
        });
    });
});

test('[Fail] Customer login with incorrect email', t => {
    return new Promise((resolve, reject) => {
        axios.post(`${baseUrl}/customer/login_action`, {
            loginEmail: 'test1@test.com',
            loginPassword: 'test'
        })
        .then((response) => {
            reject(new Error('Should not be allowed'));
        })
        .catch((error) => {
            t.deepEqual(error.response.data.err, 'A customer with that email does not exist.');
            resolve();
        });
    });
});

test('[Success] Customer login with correct email', t => {
    return new Promise((resolve, reject) => {
        axios.post(`${baseUrl}/customer/login_action`, {
            loginEmail: 'test@test.com',
            loginPassword: 'test'
        })
        .then((response) => {
            t.deepEqual(response.data.message, 'Successfully logged in');
            resolve();
        })
        .catch((error) => {
            reject(new Error('Should not be allowed'));
        });
    });
});

test('[Success] Add product to cart', t => {
    return new Promise((resolve, reject) => {
        axios.post(`${baseUrl}/product/addtocart`, {
            productId: products[0]._id,
            productQuantity: 1,
            productOptions: JSON.stringify(products[0].productOptions)
        })
        .then((response) => {
            t.deepEqual(response.data.message, 'Cart successfully updated');
            resolve();
        })
        .catch((error) => {
            reject(new Error('Should not be allowed'));
        });
    });
});

test('[Fail] Add incorrect product to cart', t => {
    return new Promise((resolve, reject) => {
        axios.post(`${baseUrl}/product/addtocart`, {
            productId: 'someid'
        })
        .then((response) => {
            t.deepEqual(response.data.message, 'Successfully logged in');
            reject(new Error('Should not be allowed'));
            resolve();
        })
        .catch((error) => {
            t.deepEqual(error.response.data.message, 'Error updating cart. Please try again.');
            resolve();
        });
    });
});
