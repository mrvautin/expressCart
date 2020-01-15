const discountValue = 10;
const discountType = 'percent';

const calculateDiscount = (config, req) => {
    let discountAmount = 0;
    if(req.session.discountCode){
        if(discountType === 'amount'){
            discountAmount = discountValue;
        }
        if(discountType === 'percent'){
            // Apply the discount on the net cart amount (eg: minus shipping)
            discountAmount = (discountValue / 100) * req.session.totalCartNetAmount;
        }
    }

    req.session.totalCartDiscount = discountAmount;
};

module.exports = {
    calculateDiscount
};
