const express = require('express');
const common = require('../../lib/common');
const { indexOrders } = require('../../lib/indexing');
const numeral = require('numeral');
const { Client, CheckoutAPI } = require('@adyen/api-library');
const router = express.Router();

router.post('/setup', async (req, res, next) => {
    const adyenConfig = common.getPaymentConfig();

    const client = new Client({
        apiKey: adyenConfig.apiKey,
        environment: adyenConfig.environment
    });
    const checkout = new CheckoutAPI(client);
    let paymentsResponse;
    try{
        paymentsResponse = await checkout.paymentMethods({
            amount: {
                currency: 'AUD',
                value: 0
            },
            countryCode: 'AU',
            channel: 'Web',
            merchantAccount: adyenConfig.merchantAccount
        });
    }catch(ex){
        console.log('Exception getting supported payment methods', ex.message);
        res.status(400).json({ message: 'Failed to retrieve payment methods.' + ex.message });
    }
    res.status(200).json({
        paymentsResponse,
        environment: adyenConfig.environment,
        publicKey: adyenConfig.publicKey
    });
});

router.post('/checkout_action', async (req, res, next) => {
    const db = req.app.db;
    const config = req.app.config;
    const adyenConfig = common.getPaymentConfig();

    const client = new Client({
        apiKey: adyenConfig.apiKey,
        environment: adyenConfig.environment
    });
    const checkout = new CheckoutAPI(client);
    let response;
    try{
        response = await checkout.payments({
            shopperInteraction: 'Ecommerce',
            amount: {
                currency: adyenConfig.currency,
                value: numeral(req.session.totalCartAmount).format('0.00').replace('.', '')
            },
            paymentMethod: JSON.parse(req.body.payment),
            reference: adyenConfig.statementDescriptor,
            merchantAccount: adyenConfig.merchantAccount,
            shopperStatement: adyenConfig.statementDescriptor
        });
    }catch(ex){
        console.log('Payment exception', ex.message);
        req.session.messageType = 'danger';
        req.session.message = 'Card declined. Contact card issuer';
        return;
    }

    // Update response
    let paymentStatus = 'Paid';
    if(response && response.resultCode !== 'Authorised'){
        paymentStatus = 'Declined';
    }

        // new order doc
    const orderDoc = {
        orderPaymentId: response.pspReference,
        orderPaymentGateway: 'Adyen',
        orderPaymentMessage: response.refusalReason,
        orderTotal: req.session.totalCartAmount,
        orderEmail: req.body.shipEmail,
        orderFirstname: req.body.shipFirstname,
        orderLastname: req.body.shipLastname,
        orderAddr1: req.body.shipAddr1,
        orderAddr2: req.body.shipAddr2,
        orderCountry: req.body.shipCountry,
        orderState: req.body.shipState,
        orderPostcode: req.body.shipPostcode,
        orderPhoneNumber: req.body.shipPhoneNumber,
        orderComment: req.body.orderComment,
        orderStatus: paymentStatus,
        orderDate: new Date(),
        orderProducts: req.session.cart,
        orderType: 'Single'
    };

    // insert order into DB
    const newOrder = await db.orders.insertOne(orderDoc);

    // get the new ID
    const newId = newOrder.insertedId;

    // add to lunr index
    indexOrders(req.app)
    .then(() => {
        // Process the result
        if(paymentStatus === 'Paid'){
            // set the results
            req.session.messageType = 'success';
            req.session.message = 'Your payment was successfully completed';
            req.session.paymentEmailAddr = orderDoc.orderEmail;
            req.session.paymentApproved = true;
            req.session.paymentDetails = '<p><strong>Order ID: </strong>' + newId + '</p><p><strong>Transaction ID: </strong>' + response.pspReference + '</p>';

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
                req.session.cart = null;
                req.session.orderId = null;
                req.session.totalCartAmount = 0;
            }

            // send the email with the response
            // TODO: Should fix this to properly handle result
            common.sendEmail(req.session.paymentEmailAddr, 'Your payment with ' + config.cartTitle, common.getEmailTemplate(paymentResults));
        }
        res.status(200).json({ paymentId: newId });
    });
});

module.exports = router;
