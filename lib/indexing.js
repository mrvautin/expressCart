const colors = require('colors');
const lunr = require('lunr');

const indexProducts = (app) => {
    // index all products in lunr on startup
    return new Promise((resolve, reject) => {
        app.db.products.find({}).toArray((err, productsList) => {
            if(err){
                console.error(colors.red(err.stack));
                reject(err);
            }

            // setup lunr indexing
            const productsIndex = lunr(function(){
                this.field('productTitle', { boost: 10 });
                this.field('productTags', { boost: 5 });
                this.field('productDescription');

                const lunrIndex = this;

                // add to lunr index
                productsList.forEach((product) => {
                    const doc = {
                        productTitle: product.productTitle,
                        productTags: product.productTags,
                        productDescription: product.productDescription,
                        id: product._id
                    };
                    lunrIndex.add(doc);
                });
            });

            app.productsIndex = productsIndex;
            if(process.env.NODE_ENV !== 'test'){
                console.log(colors.cyan('- Product indexing complete'));
            }
            resolve();
        });
    });
};

const indexCustomers = (app) => {
    // index all products in lunr on startup
    return new Promise((resolve, reject) => {
        app.db.customers.find({}).toArray((err, customerList) => {
            if(err){
                console.error(colors.red(err.stack));
                reject(err);
            }

            // setup lunr indexing
            const customersIndex = lunr(function(){
                this.field('email', { boost: 10 });
                this.field('name', { boost: 5 });
                this.field('phone');

                const lunrIndex = this;

                // add to lunr index
                customerList.forEach((customer) => {
                    const doc = {
                        email: customer.email,
                        name: `${customer.firstName} ${customer.lastName}`,
                        phone: customer.phone,
                        id: customer._id
                    };
                    lunrIndex.add(doc);
                });
            });

            app.customersIndex = customersIndex;
            if(process.env.NODE_ENV !== 'test'){
                console.log(colors.cyan('- Customer indexing complete'));
            }
            resolve();
        });
    });
};

const indexOrders = (app, cb) => {
    // index all orders in lunr on startup
    return new Promise((resolve, reject) => {
        app.db.orders.find({}).toArray((err, ordersList) => {
            if(err){
                console.error(colors.red('Error setting up products index: ' + err));
                reject(err);
            }

            // setup lunr indexing
            const ordersIndex = lunr(function(){
                this.field('orderEmail', { boost: 10 });
                this.field('orderLastname', { boost: 5 });
                this.field('orderPostcode');

                const lunrIndex = this;

                // add to lunr index
                ordersList.forEach((order) => {
                    const doc = {
                        orderLastname: order.orderLastname,
                        orderEmail: order.orderEmail,
                        orderPostcode: order.orderPostcode,
                        id: order._id
                    };
                    lunrIndex.add(doc);
                });
            });

            app.ordersIndex = ordersIndex;
            if(process.env.NODE_ENV !== 'test'){
                console.log(colors.cyan('- Order indexing complete'));
            }
            resolve();
        });
    });
};

// start indexing products and orders
const runIndexing = (app) => {
    if(process.env.NODE_ENV !== 'test'){
        console.info(colors.yellow('Setting up indexes..'));
    }

    return Promise.all([
        indexProducts(app),
        indexOrders(app),
        indexCustomers(app)
    ])
    .catch((err) => {
        console.info(colors.yellow('Error setting up indexes', err));
        process.exit(2);
    });
};

module.exports = {
    indexProducts,
    indexCustomers,
    indexOrders,
    runIndexing
};
