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

const fixProductIds = async (jsonVariants, products) => {
    const variants = [];
    let productIndex = 0;
    // Loop products
    products.forEach((product) => {
        // Only add variants to certain products
        if(productIndex % 2 === 0){
            // Add all available variants
            jsonVariants.forEach((jsonVariant) => {
                const variant = {};
                Object.assign(variant, jsonVariant);
                // Add the product to the variant
                variant.product = product._id;
                variants.push(variant);
            });
        }
        productIndex++;
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
