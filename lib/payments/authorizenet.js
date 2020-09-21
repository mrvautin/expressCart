const express = require('express');
const axios = require('axios');
const stripBom = require('strip-bom');
const { indexOrders } = require('../indexing');
const { getId, sendEmail, getEmailTemplate } = require('../common');
const { getPaymentConfig } = require('../config');
const { emptyCart } = require('../cart');
const router = express.Router();

// The homepage of the site
router.post('/checkout_action', (req, res, next) => {
    const db = req.app.db;
    const config = req.app.config;
    const authorizenetConfig = getPaymentConfig('authorizenet');

    let authorizeUrl = 'https://api.authorize.net/xml/v1/request.api';
    if(authorizenetConfig.mode === 'test'){
        authorizeUrl = 'https://apitest.authorize.net/xml/v1/request.api';
    }

    const chargeJson = {
        createTransactionRequest: {
            merchantAuthentication: {
                name: authorizenetConfig.loginId,
                transactionKey: authorizenetConfig.transactionKey
            },
            transactionRequest: {
                transactionType: 'authCaptureTransaction',
                amount: req.session.totalCartAmount,
                payment: {
                    opaqueData: {
                        dataDescriptor: req.body.opaqueData.dataDescriptor,
                        dataValue: req.body.opaqueData.dataValue
                    }
                }
            }
        }
    };

    axios.post(authorizeUrl, chargeJson, { responseType: 'text' })
    .then(async(response) => {
        // This is crazy but the Authorize.net API returns a string with BOM and totally
        // screws the JSON response being parsed. So many hours wasted!
        const txn = JSON.parse(stripBom(response.data)).transactionResponse;

        if(!txn){
            console.log('Declined request payload', chargeJson);
            console.log('Declined response payload', response.data);
            res.status(400).json({ err: 'Your payment has declined. Please try again' });
            return;
        }

        // order status if approved
        let orderStatus = 'Paid';
        if(txn && txn.responseCode !== '1'){
            console.log('Declined response payload', response.data);
            orderStatus = 'Declined';
        }

        const orderDoc = {
            orderPaymentId: txn.transHash,
            orderPaymentGateway: 'AuthorizeNet',
            orderPaymentMessage: 'Your payment was successfully completed',
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
            orderStatus: orderStatus,
            orderDate: new Date(),
            orderProducts: req.session.cart,
            orderType: 'Single'
        };

        // insert order into DB
        try{
            const newDoc = await db.orders.insertOne(orderDoc);

            // get the new ID
            const newId = newDoc.insertedId;

            // add to lunr index
            indexOrders(req.app)
            .then(() => {
                // if approved, send email etc
                if(orderStatus === 'Paid'){
                    // set the results
                    req.session.messageType = 'success';
                    req.session.message = 'Your payment was successfully completed';
                    req.session.paymentEmailAddr = newDoc.ops[0].orderEmail;
                    req.session.paymentApproved = true;
                    req.session.paymentDetails = `<p><strong>Order ID: </strong>${newId}</p>
                    <p><strong>Transaction ID: </strong>${orderDoc.orderPaymentId}</p>`;

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

                    // redirect to outcome
                    res.status(200).json({ orderId: newId });
                }else{
                    // redirect to failure
                    req.session.messageType = 'danger';
                    req.session.message = 'Your payment has declined. Please try again';
                    req.session.paymentApproved = false;
                    req.session.paymentDetails = `<p><strong>Order ID: </strong>${newId}
                    </p><p><strong>Transaction ID: </strong> ${txn.transHash}</p>`;
                    res.status(400).json({ err: true, orderId: newId });
                }
            });
        }catch(ex){
            console.log('Error sending payment to API', ex);
            res.status(400).json({ err: 'Your payment has declined. Please try again' });
        }
    })
    .catch((err) => {
        console.log('Error sending payment to API', err);
        res.status(400).json({ err: 'Your payment has declined. Please try again' });
    });
});

module.exports = router;
