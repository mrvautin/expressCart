const {
    getConfig
} = require('./config');

const updateTotalCart = async (req, res) => {
    const config = getConfig();
    const db = req.app.db;

    req.session.totalCartAmount = 0;
    req.session.totalCartItems = 0;
    req.session.totalCartProducts = 0;

    // If cart is empty return zero values
    if(!req.session.cart){
        return;
    }

    Object.keys(req.session.cart).forEach((item) => {
        req.session.totalCartAmount = req.session.totalCartAmount + req.session.cart[item].totalItemPrice;
        req.session.totalCartProducts = req.session.totalCartProducts + req.session.cart[item].quantity;
    });

    // Update the total items in cart for the badge
    req.session.totalCartItems = Object.keys(req.session.cart).length;

    // Update the total amount not including shipping/discounts
    req.session.totalCartNetAmount = req.session.totalCartAmount;

    // Update checking cart for subscription
    updateSubscriptionCheck(req, res);

    // Calculate shipping using the loaded module
    config.modules.loaded.shipping.calculateShipping(
        req.session.totalCartNetAmount,
        config,
        req
    );

    // If discount module enabled
    if(config.modules.loaded.discount){
        // Recalculate discounts
        const discount = await db.discounts.findOne({ code: req.session.discountCode });
        if(discount){
            config.modules.loaded.discount.calculateDiscount(
                discount,
                req
            );
        }else{
            // If discount code is not found, remove it
            delete req.session.discountCode;
            req.session.totalCartDiscount = 0;
        }
    }

    // Calculate our total amount removing discount and adding shipping
    req.session.totalCartAmount = (req.session.totalCartNetAmount - req.session.totalCartDiscount) + req.session.totalCartShipping;
};

const updateSubscriptionCheck = (req, res) => {
    // If cart is empty
    if(!req.session.cart || req.session.cart.length === 0){
        req.session.cartSubscription = null;
        return;
    }

    Object.keys(req.session.cart).forEach((item) => {
        if(req.session.cart[item].productSubscription){
            req.session.cartSubscription = req.session.cart[item].productSubscription;
        }else{
            req.session.cartSubscription = null;
        }
    });
};

const emptyCart = async (req, res, type, customMessage) => {
    const db = req.app.db;

    // Remove from session
    delete req.session.cart;
    delete req.session.shippingAmount;
    delete req.session.orderId;
    delete req.session.cartSubscription;
    delete req.session.discountCode;

    // Remove cart from DB
    await db.cart.deleteOne({ sessionId: req.session.id });

    // update total cart
    await updateTotalCart(req, res);

    // Update checking cart for subscription
    updateSubscriptionCheck(req, res);

    // Set returned message
    let message = 'Cart successfully emptied';
    if(customMessage){
        message = customMessage;
    }

    if(type === 'function'){
        return;
    }

    // If POST, return JSON else redirect nome
    if(type === 'json'){
        res.status(200).json({ message: message, totalCartItems: 0 });
        return;
    }

    req.session.message = message;
    req.session.messageType = 'success';
    res.redirect('/');
};

module.exports = {
    updateTotalCart,
    updateSubscriptionCheck,
    emptyCart
};
