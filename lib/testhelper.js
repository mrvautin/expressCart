const moment = require('moment');

const fixProductDates = (products) => {
    let index = 0;
    products.forEach(() => {
        products[index].productAddedDate = new Date();
        index++;
    });
    return products;
};

const fixDiscountDates = (discounts) => {
    let index = 0;
    discounts.forEach(() => {
        let startDate = moment().subtract(1, 'days').toDate();
        let endDate = moment().add(7, 'days').toDate();
        const expiredStart = moment().subtract(14, 'days').toDate();
        const expiredEnd = moment().subtract(7, 'days').toDate();
        const futureStart = moment().add(7, 'days').toDate();
        const futureEnd = moment().add(14, 'days').toDate();

        // If code is expired, make sure the dates are correct
        if(discounts[index].code.substring(0, 7) === 'expired'){
            startDate = expiredStart;
            endDate = expiredEnd;
        }

        // If code is future, make sure the dates are correct
        if(discounts[index].code.substring(0, 6) === 'future'){
            startDate = futureStart;
            endDate = futureEnd;
        }

        // Set the expiry dates
        discounts[index].start = startDate;
        discounts[index].end = endDate;
        index++;
    });
    return discounts;
};

const fixProductIds = async (variants, products) => {
    let index = 0;
    variants.forEach(() => {
        // Set to a random product ID
        const product = products[getRandom(products.length)];
        variants[index].product = product._id;
        index++;
    });

    return variants;
};

const getRandom = (max) => {
    return Math.floor(Math.random() * Math.floor(max));
};

module.exports = {
    fixProductDates,
    fixDiscountDates,
    fixProductIds,
    getRandom
};
