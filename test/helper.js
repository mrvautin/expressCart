const fs = require('fs');
const _ = require('lodash');
const supertest = require('supertest');
const app = require('../app.js');
const { newId } = require('../lib/common');
const { fixProductDates, fixDiscountDates, getRandom } = require('../lib/testhelper');
const { runIndexing } = require('../lib/indexing');

// Get test data to compare in tests
const rawTestData = fs.readFileSync('./bin/testdata.json', 'utf-8');
const jsonData = JSON.parse(rawTestData);

// Setup some global DB objects for comparison
const g = {
    db: {},
    config: {},
    products: {},
    variants: {},
    discounts: {},
    customers: {},
    users: {},
    reviews: {},
    request: null,
    jsonData
};

const setup = (db) => {
    return Promise.all([
        db.cart.deleteMany({}, {}),
        db.users.deleteMany({}, {}),
        db.customers.deleteMany({}, {}),
        db.products.deleteMany({}, {}),
        db.variants.deleteMany({}, {}),
        db.discounts.deleteMany({}, {}),
        db.orders.deleteMany({}, {}),
        db.sessions.deleteMany({}, {}),
        db.reviews.deleteMany({}, {})
    ])
    .then(() => {
        return Promise.all([
            db.users.insertMany(addApiKey(jsonData.users)),
            db.customers.insertMany(jsonData.customers),
            db.products.insertMany(fixProductDates(jsonData.products)),
            db.discounts.insertMany(fixDiscountDates(jsonData.discounts))
        ]);
    });
};

const runBefore = async () => {
    // Create a session
    g.request = supertest.agent(app);
    await new Promise(resolve => {
        app.on('appStarted', async () => {
            // Set some stuff now we have the app started
            g.config = app.config;
            g.db = app.db;

            await setup(g.db);

            // Get some data from DB to use in compares
            g.products = await g.db.products.find({}).toArray();
            g.customers = await g.db.customers.find({}).toArray();
            g.discounts = await g.db.discounts.find({}).toArray();
            g.users = await g.db.users.find({}).toArray();

            // Insert variants using product ID's
            for(const variant of jsonData.variants){
                variant.product = g.products[getRandom(g.products.length)]._id;
                await g.db.variants.insertOne(variant);
            };
            g.variants = await g.db.variants.find({}).toArray();

            // Insert orders using product ID's
            for(const order of jsonData.orders){
                order.orderProducts.push({
                    productId: g.products[0]._id,
                    title: g.products[0].productTitle,
                    quantity: 1,
                    totalItemPrice: g.products[0].productPrice,
                    variant: g.variants[0]._id,
                    productImage: g.products[0].productImage,
                    productComment: null
                });
                order.orderDate = new Date();
                await g.db.orders.insertOne(order);
            };
            g.orders = await g.db.orders.find({}).toArray();

            // Fix reviews
            for(const review of jsonData.reviews){
                review.date = new Date();
                review.product = g.products[0]._id;
                review.customer = g.customers[0]._id;
                await g.db.reviews.insertOne(review);
            };
            g.reviews = await g.db.reviews.find({}).toArray();

            // Get csrf token
            const csrf = await g.request
            .get('/admin/csrf');
            g.csrf = csrf.body.csrf;

            // Index everything
            await runIndexing(app);

            resolve();
        });
    });
};

const addApiKey = (users) => {
    let index = 0;
    users.forEach(() => {
        users[index].apiKey = newId();
        index++;
    });
    return users;
};

module.exports = {
    runBefore,
    setup,
    g
};
