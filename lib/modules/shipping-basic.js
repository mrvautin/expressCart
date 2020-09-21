const domesticShippingAmount = 10;
const internationalShippingAmount = 25;
const freeThreshold = 100;
const shippingFromCountry = 'Australia';

const calculateShipping = (amount, config, req) => {
    if(amount >= freeThreshold){
        req.session.shippingMessage = 'FREE shipping';
        req.session.totalCartShipping = 0;
        req.session.totalCartAmount = req.session.totalCartAmount + 0;
        return;
    }

    // If there is no country set, we estimate shipping
    if(!req.session.customerCountry){
        req.session.shippingMessage = 'Estimated shipping';
        req.session.totalCartShipping = domesticShippingAmount;
        req.session.totalCartAmount = amount + domesticShippingAmount;
        return;
    }

    // Check for international
    if(req.session.customerCountry.toLowerCase() !== shippingFromCountry.toLowerCase()){
        req.session.shippingMessage = 'International shipping';
        req.session.totalCartShipping = internationalShippingAmount;
        req.session.totalCartAmount = amount + internationalShippingAmount;
        return;
    }

    // Domestic shipping
    req.session.shippingMessage = 'Domestic shipping';
    req.session.totalCartShipping = domesticShippingAmount;
    req.session.totalCartAmount = amount + domesticShippingAmount;
};

module.exports = {
    calculateShipping
};
