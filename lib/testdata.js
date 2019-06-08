const common = require('./common');
const { initDb } = require('./db');
const fs = require('fs');
const path = require('path');

console.log('__dirname', path.join(__dirname, '..', 'bin', 'testdata.json'));

const testData = fs.readFileSync(path.join(__dirname, '..', 'bin', 'testdata.json'), 'utf-8');
const jsonData = JSON.parse(testData);

// get config
let config = common.getConfig();

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
            reject(err);
        });
    })
    .catch((err) => {
        console.log('Error removing existing test data', err);
        reject(err);
    });
});

// Adds current date to product added date when smashing into DB
function fixProductDates(products){
    let index = 0;
    products.forEach((product) => {
        products[index].productAddedDate = new Date();
        index++;
    });
    return products;
}
