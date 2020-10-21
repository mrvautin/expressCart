const { getConfig } = require('./config');
const { initDb } = require('./db');
const { fixProductDates, fixDiscountDates, fixProductIds, fixReviews } = require('../lib/testhelper');
const fs = require('fs');
const path = require('path');

const testData = fs.readFileSync(path.join(__dirname, '..', 'bin', 'testdata.json'), 'utf-8');
const jsonData = JSON.parse(testData);

// get config
const config = getConfig();

initDb(config.databaseConnectionString, (err, db) => {
    Promise.all([
        db.users.deleteMany({}, {}),
        db.customers.deleteMany({}, {}),
        db.products.deleteMany({}, {}),
        db.discounts.deleteMany({}, {}),
        db.variants.deleteMany({}, {}),
        db.menu.deleteMany({}, {}),
        db.reviews.deleteMany({}, {})
    ])
    .then(() => {
        Promise.all([
            db.users.insertMany(jsonData.users),
            db.customers.insertMany(jsonData.customers),
            db.products.insertMany(fixProductDates(jsonData.products)),
            db.discounts.insertMany(fixDiscountDates(jsonData.discounts)),
            db.menu.insertOne(jsonData.menu)
        ])
        .then(async() => {
            const products = await db.products.find({}).toArray();
            const customers = await db.customers.find({}).toArray();
            await db.variants.insertMany(await fixProductIds(jsonData.variants, products));
            await db.reviews.insertMany(await fixReviews(jsonData.reviews, products, customers));
            console.log('Test data complete');
            process.exit();
        })
        .catch((err) => {
            console.log('Error inserting test data', err);
            process.exit(2);
        });
    })
    .catch((err) => {
        console.log('Error removing existing test data', err);
        process.exit(2);
    });
});
