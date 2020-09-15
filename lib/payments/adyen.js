const express = require('express');
const { indexOrders } = require('../indexing');
const numeral = require('numeral');
const { Client, CheckoutAPI } = require('@adyen/api-library');
const { getId, sendEmail, getEmailTemplate } = require('../common');
const { getPaymentConfig } = require('../config');
const { emptyCart } = require('../cart');
const router = express.Router();

router.post('/setup', async (req, res, next) => {
    const adyenConfig = getPaymentConfig('adyen');

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
        res.status(400).json({ message: `Failed to retrieve payment methods.${ex.message}` });
    }
    res.status(200).json({
        paymentsResponse,
        environment: adyenConfig.environment,
        originKey: adyenConfig.originKey
    });
});

router.post('/checkout_action', async (req, res, next) => {
    const db = req.app.db;
    const config = req.app.config;
    const adyenConfig = getPaymentConfig('adyen');

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
            req.session.paymentDetails = `<p><strong>Order ID: </strong>${newId}</p><p><strong>Transaction ID: </strong>${response.pspReference}</p>`;

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
        }
        res.status(200).json({ paymentId: newId });
    });
});

module.exports = router;
