const MongoClient = require('mongodb').MongoClient;
const mongodbUri = require('mongodb-uri');

let _db;

function initDb(dbUrl, callback){ // eslint-disable-line
    if(_db){
        console.warn('Trying to init DB again!');
        return callback(null, _db);
    }
    MongoClient.connect(dbUrl, { useNewUrlParser: true }, connected);
    function connected(err, client){
        if(err){
            return callback(err);
        }

        // select DB
        const dbUriObj = mongodbUri.parse(dbUrl);
        let db;
        // if in testing, set the testing DB
        if(process.env.NODE_ENV === 'test'){
            db = client.db('testingdb');
        }else{
            db = client.db(dbUriObj.database);
        }

        // setup the collections
        db.users = db.collection('users');
        db.products = db.collection('products');
        db.orders = db.collection('orders');
        db.pages = db.collection('pages');
        db.menu = db.collection('menu');
        db.customers = db.collection('customers');
        db.cart = db.collection('cart');
        db.sessions = db.collection('sessions');

        _db = db;
        return callback(null, _db);
    }
};

function getDb(){
    return _db;
}

module.exports = {
    getDb,
    initDb
};
