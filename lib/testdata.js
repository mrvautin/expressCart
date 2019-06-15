const { getConfig } = require('./common');
const { initDb } = require('./db');
const { fixProductDates } = require('./indexing');
const fs = require('fs');
const path = require('path');

const testData = fs.readFileSync(path.join(__dirname, '..', 'bin', 'testdata.json'), 'utf-8');
const jsonData = JSON.parse(testData);

// get config
let config = getConfig();

initDb(config.databaseConnectionString, (err, db) => {
    Promise.all([
        db.users.remove({}, {}),
        db.customers.remove({}, {}),
        db.products.remove({}, {}),
        db.menu.remove({}, {})
    ])
    .then(() => {
        Promise.all([
            db.users.insertMany(jsonData.users),
            db.customers.insertMany(jsonData.customers),
            db.products.insertMany(fixProductDates(jsonData.products)),
            db.menu.insertOne(jsonData.menu)
        ])
        .then(() => {
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
