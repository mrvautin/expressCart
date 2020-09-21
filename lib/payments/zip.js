const express = require('express');
const { indexOrders } = require('../indexing');
const { getId, sendEmail, getEmailTemplate } = require('../common');
const { getPaymentConfig } = require('../config');
const { emptyCart } = require('../cart');
const axios = require('axios');
const ObjectId = require('mongodb').ObjectID;
const router = express.Router();

// The homepage of the site
router.post('/setup', async (req, res, next) => {
    const db = req.app.db;
    const config = req.app.config;
    const paymentConfig = getPaymentConfig('zip');

    const payloadConfig = {
        headers: {
            Authorization: `Bearer ${paymentConfig.privateKey}`,
            'zip-Version': '2017-03-01',
            'Content-Type': 'application/json'
        }
    };

    // Check country is supported
    if(!paymentConfig.supportedCountries.includes(req.session.customerCountry)){
        res.status(400).json({
            error: 'Unfortunately Zip is not supported in your country.'
        });
        return;
    }

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
                country: 'AU'
            }
        },
        order: {
            amount: req.session.totalCartAmount,
            currency: 'AUD',
            shipping: {
                pickup: false,
                address: {
                    line1: req.session.customerAddress1,
                    city: req.session.customerAddress2,
                    state: req.session.customerState,
                    postal_code: req.session.customerPostcode,
                    country: 'AU'
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
            redirect_uri: 'http://localhost:1111/zip/response'
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
        const response = await axios.post('https://api.sandbox.zipmoney.com.au/merchant/v1/checkouts',
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

router.get('/response', async (req, res, next) => {
    const db = req.app.db;
    const result = req.query.result;
    const config = req.app.config;
    const checkoutId = req.query.checkoutId;

    // Set the order fields
    const updateDoc = {
        orderStatus: 'Paid',
        orderPaymentMessage: 'Payment completed successfully',
        orderPaymentId: checkoutId
    };
    if(result === 'cancelled'){
        // Delete and return if cancelled
        await db.orders.deleteOne({ _id: ObjectId(req.session.orderId) });
        res.redirect('/checkout/payment');
        return;
    }

    // Update the order
    await db.orders.updateOne({
        _id: ObjectId(req.session.orderId)
        },
        { $set: updateDoc },
    { multi: false, returnOriginal: false });

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
        return res.redirect(`/payment/${req.session.orderId}`);
    });
});

module.exports = router;
