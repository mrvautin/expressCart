const express = require('express');
const { indexOrders, indexTransactions } = require('../indexing');
const { getId, sendEmail, getEmailTemplate, getCountryNameToCode } = require('../common');
const { getPaymentConfig } = require('../config');
const { emptyCart } = require('../cart');
const axios = require('axios');
const ObjectId = require('mongodb').ObjectID;
const paymentConfig = getPaymentConfig('zip');
const router = express.Router();

// Setup the API
const payloadConfig = {
    headers: {
        Authorization: `Bearer ${paymentConfig.privateKey}`,
        'zip-Version': '2017-03-01',
        'Content-Type': 'application/json'
    }
};
let apiUrl = 'https://api.zipmoney.com.au/merchant/v1';
if(paymentConfig.mode === 'test'){
    apiUrl = 'https://api.sandbox.zipmoney.com.au/merchant/v1';
}

// The homepage of the site
router.post('/setup', async (req, res, next) => {
    const db = req.app.db;
    const config = req.app.config;
    const paymentConfig = getPaymentConfig('zip');

    // Check country is supported
    if(!paymentConfig.supportedCountries.includes(req.session.customerCountry)){
        res.status(400).json({
            error: 'Unfortunately Zip is not supported in your country.'
        });
        return;
    }

    if(!req.session.cart){
        res.status(400).json({
            error: 'Cart is empty. Please add something to your cart before checking out.'
        });
        return;
    }

    // Get country code from country name
    const countryCode = getCountryNameToCode(req.session.customerCountry).code;

    // Create the payload
    const payload = {
        shopper: {
            first_name: req.session.customerFirstname,
            last_name: req.session.customerLastname,
            phone: req.session.customerPhone,
            email: req.session.customerEmail,
            billing_address: {
                line1: req.session.customerAddress1,
                city: req.session.customerAddress2,
                state: req.session.customerState,
                postal_code: req.session.customerPostcode,
                country: countryCode
            }
        },
        order: {
            amount: req.session.totalCartAmount,
            currency: paymentConfig.currency,
            shipping: {
                pickup: false,
                address: {
                    line1: req.session.customerAddress1,
                    city: req.session.customerAddress2,
                    state: req.session.customerState,
                    postal_code: req.session.customerPostcode,
                    country: countryCode
                }
            },
            items: [
                {
                    name: 'Shipping',
                    amount: req.session.totalCartShipping,
                    quantity: 1,
                    type: 'shipping',
                    reference: 'Shipping amount'
                }
            ]
        },
        config: {
            redirect_uri: 'http://localhost:1111/zip/return'
        }
    };

    // Loop items in the cart
    Object.keys(req.session.cart).forEach((cartItemId) => {
        const cartItem = req.session.cart[cartItemId];
        const item = {
            name: cartItem.title,
            amount: cartItem.totalItemPrice,
            quantity: cartItem.quantity,
            type: 'sku',
            reference: cartItem.productId.toString()
        };

        if(cartItem.productImage && cartItem.productImage !== ''){
            item.image_uri = `${config.baseUrl}${cartItem.productImage}`;
        }
        payload.order.items.push(item);
    });

    try{
        const response = await axios.post(`${apiUrl}/checkouts`,
            payload,
            payloadConfig
        );

        // Setup order
        const orderDoc = {
            orderPaymentId: response.data.id,
            orderPaymentGateway: 'Zip',
            orderTotal: req.session.totalCartAmount,
            orderShipping: req.session.totalCartShipping,
            orderItemCount: req.session.totalCartItems,
            orderProductCount: req.session.totalCartProducts,
            orderCustomer: getId(req.session.customerId),
            orderEmail: req.session.customerEmail,
            orderCompany: req.session.customerCompany,
            orderFirstname: req.session.customerFirstname,
            orderLastname: req.session.customerLastname,
            orderAddr1: req.session.customerAddress1,
            orderAddr2: req.session.customerAddress2,
            orderCountry: req.session.customerCountry,
            orderState: req.session.customerState,
            orderPostcode: req.session.customerPostcode,
            orderPhoneNumber: req.session.customerPhone,
            orderComment: req.session.orderComment,
            orderStatus: 'Pending',
            orderDate: new Date(),
            orderProducts: req.session.cart,
            orderType: 'Single'
        };

        // insert order into DB
        const order = await db.orders.insertOne(orderDoc);

        // Set the order ID for the response
        req.session.orderId = order.insertedId;

        // add to lunr index
        indexOrders(req.app)
        .then(() => {
            // Return response
            res.json({
                orderId: order.insertedId,
                redirectUri: response.data.uri
            });
        });
    }catch(ex){
        console.log('ex', ex);
        res.status(400).json({
            error: 'Failed to process payment'
        });
    }
});

router.get('/return', async (req, res, next) => {
    const db = req.app.db;
    const result = req.query.result;

    // If cancelled
    if(result === 'cancelled'){
        // Update the order
        await db.orders.deleteOne({
            _id: ObjectId(req.session.orderId)
        });
    }

    res.redirect('/checkout/payment');
});

router.post('/charge', async (req, res, next) => {
    const db = req.app.db;
    const config = req.app.config;
    const paymentConfig = getPaymentConfig('zip');
    const checkoutId = req.body.checkoutId;

    // grab order
    const order = await db.orders.findOne({ _id: ObjectId(req.session.orderId) });

    // Cross check the checkoutId
    if(checkoutId !== order.orderPaymentId){
        console.log('order check failed');
        res.status(400).json({ err: 'Order not found. Please try again.' });
        return;
    }

    // Create charge payload
    const payload = {
        authority: {
            type: 'checkout_id',
            value: checkoutId
        },
        reference: order._id,
        amount: order.orderTotal,
        currency: paymentConfig.currency,
        capture: true
    };

    try{
        // Create charge
        const response = await axios.post(`${apiUrl}/charges`,
            payload,
            payloadConfig
        );

        let paymentMessage = 'Payment completed successfully';
        let approved = true;
        let orderStatus = 'Paid';

        // Update result
        if(response.data.state === 'captured'){
            orderStatus = 'Paid';
            paymentMessage = 'Payment completed successfully';
        }else{
            paymentMessage = `Check payment: ${response.data.state}`;
            orderStatus = 'Declined';
            approved = false;
        }

        // Create our transaction
        const transaction = await db.transactions.insertOne({
            gateway: 'zip',
            gatewayReference: checkoutId,
            gatewayMessage: paymentMessage,
            approved: approved,
            amount: req.session.totalCartAmount,
            currency: paymentConfig.currency,
            customer: getId(req.session.customerId),
            created: new Date(),
            order: getId(order._id)
        });

        const transactionId = transaction.insertedId;

        // Index transactios
        await indexTransactions(req.app);

        // Update the order
        await db.orders.updateOne({
            _id: ObjectId(req.session.orderId)
            },
            { $set: orderStatus, transaction: transactionId },
        { multi: false, returnOriginal: false });

        // Return decline
        if(approved === false){
            res.status(400).json({ err: 'Your payment has declined. Please try again' });
            return;
        }

        // set payment results for email
        const paymentResults = {
            message: req.session.message,
            messageType: req.session.messageType,
            paymentEmailAddr: req.session.paymentEmailAddr,
            paymentApproved: true,
            paymentDetails: req.session.paymentDetails
        };

        // clear the cart
        if(req.session.cart){
            emptyCart(req, res, 'function');
        }

        // send the email with the response
        // TODO: Should fix this to properly handle result
        sendEmail(req.session.paymentEmailAddr, `Your payment with ${config.cartTitle}`, getEmailTemplate(paymentResults));

        // add to lunr index
        indexOrders(req.app)
        .then(() => {
            res.json({
                message: 'Payment completed successfully',
                paymentId: order._id
            });
        });
    }catch(ex){
        console.log('ex', ex);
        res.status(400).json({
            error: 'Failed to process payment'
        });
    }
});

module.exports = router;
