const shippingAmount = 10;
const freeThreshold = 100;

const calculateShipping = (amount) => {
    if(amount >= freeThreshold){
        return 0;
    }
    return shippingAmount;
};

module.exports = {
    calculateShipping
};
