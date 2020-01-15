const discountValue = 10;
const discountType = 'percent'

const calculateDiscount = (config, req) => {
    // Discount code
    let discountAmount = 0;
    if(req.session.discountCode){
        if(discountType === 'amount'){
            discountAmount = discountValue;
        }
        if(discountType === 'percent'){
            discountAmount = (discountValue / 100) * req.session.totalCartAmount;
        }
    }

    console.log('discountAmount', discountAmount);
    req.session.totalCartDiscount = discountAmount;
    req.session.totalCartAmount = req.session.totalCartAmount - discountAmount;
};

module.exports = {
    calculateDiscount
};
