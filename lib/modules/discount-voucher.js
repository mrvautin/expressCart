const calculateDiscount = (discount, req) => {
    let discountAmount = 0;
    if(req.session.discountCode){
        if(discount.type === 'amount'){
            discountAmount = discount.value;
        }
        if(discount.type === 'percent'){
            // Apply the discount on the net cart amount (eg: minus shipping)
            discountAmount = (discount.value / 100) * req.session.totalCartNetAmount;
        }
    }

    req.session.totalCartDiscount = discountAmount;
};

module.exports = {
    calculateDiscount
};
