const shippingAmount = 10;
const freeThreshold = 100;

const calculateShipping = (amount, config) => {
    // When set to instore shipping is not applicable.
    if(config.paymentGateway === 'instore'){
        return 0;
    }
    if(amount >= freeThreshold){
        return 0;
    }
    return shippingAmount;
};

module.exports = {
    calculateShipping
};
