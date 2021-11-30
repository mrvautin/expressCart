const colors = require('colors');
const lunr = require('lunr');

const indexProducts = async (app) => {
    // Get products
    const productsList = await app.db.products.find({}).toArray();

    // Setup index
    const productsIndex = lunr(function(){
        this.field('productTitle', { boost: 10 });
        this.field('productTags', { boost: 5 });
        this.field('productDescription');
        const lunrIndex = this;

        // add to lunr index
        for(const product of productsList){
            const doc = {
                productTitle: product.productTitle,
                productTags: product.productTags,
                productDescription: product.productDescription,
                id: product._id
            };
            lunrIndex.add(doc);
        };
    });

    app.productsIndex = productsIndex;
    if(process.env.NODE_ENV !== 'test'){
        console.log(colors.cyan('- Product indexing complete'));
    }
};

const indexCustomers = async (app) => {
    // Get customer
    const customerList = await app.db.customers.find({}).toArray();

    // Setup index
    const customersIndex = lunr(function(){
        this.field('email', { boost: 10 });
        this.field('name', { boost: 5 });
        this.field('phone');

        const lunrIndex = this;

        // add to lunr index
        for(const customer of customerList){
            const doc = {
                email: customer.email,
                name: `${customer.firstName} ${customer.lastName}`,
                phone: customer.phone,
                id: customer._id
            };
            lunrIndex.add(doc);
        };
    });

    app.customersIndex = customersIndex;
    if(process.env.NODE_ENV !== 'test'){
        console.log(colors.cyan('- Customer indexing complete'));
    }
};

const indexOrders = async (app) => {
    // Get orders
    const ordersList = await app.db.orders.find({}).toArray();

    // setup lunr indexing
    const ordersIndex = lunr(function(){
        this.field('orderEmail', { boost: 10 });
        this.field('orderLastname', { boost: 5 });
        this.field('orderPostcode');

        const lunrIndex = this;

        // add to lunr index
        for(const order of ordersList){
            const doc = {
                orderLastname: order.orderLastname,
                orderEmail: order.orderEmail,
                orderPostcode: order.orderPostcode,
                id: order._id
            };
            lunrIndex.add(doc);
        };
    });

    app.ordersIndex = ordersIndex;
    if(process.env.NODE_ENV !== 'test'){
        console.log(colors.cyan('- Order indexing complete'));
    }
};

const indexTransactions = async(app) => {
    // Get transactions
    const transactionsList = await app.db.transactions.find({}).toArray();

    // setup lunr indexing
    const transactionsIndex = lunr(function(){
        this.field('gatewayReference', { boost: 10 });
        this.field('amount', { boost: 5 });
        this.field('customer', { boost: 5 });
        this.field('gatewayMessage');

        const lunrIndex = this;

        // add to lunr index
        for(const transaction of transactionsList){
            const doc = {
                gatewayReference: transaction.gatewayReference,
                amount: transaction.amount,
                customer: transaction.customer,
                gatewayMessage: transaction.gatewayMessage,
                id: transaction._id
            };
            lunrIndex.add(doc);
        };
    });

    app.transactionsIndex = transactionsIndex;
    if(process.env.NODE_ENV !== 'test'){
        console.log(colors.cyan('- Transaction indexing complete'));
    }
};

const indexReviews = async(app) => {
    // Get reviews
    const reviewsList = await app.db.reviews.find({}).toArray();

    // setup lunr indexing
    const reviewsIndex = lunr(function(){
        this.field('title', { boost: 10 });
        this.field('description', { boost: 5 });
        this.field('rating');

        const lunrIndex = this;

        // add to lunr index
        for(const review of reviewsList){
            const doc = {
                title: review.title,
                description: review.description,
                rating: review.rating,
                id: review._id
            };
            lunrIndex.add(doc);
        };
    });

    app.reviewsIndex = reviewsIndex;
    if(process.env.NODE_ENV !== 'test'){
        console.log(colors.cyan('- Review indexing complete'));
    }
};

// start indexing products and orders
const runIndexing = async (app) => {
    if(process.env.NODE_ENV !== 'test'){
        console.info(colors.yellow('Setting up indexes..'));
    }

    await indexProducts(app);
    await indexOrders(app);
    await indexCustomers(app);
    await indexTransactions(app);
    await indexReviews(app);
};

module.exports = {
    indexProducts,
    indexCustomers,
    indexOrders,
    indexTransactions,
    indexReviews,
    runIndexing
};
