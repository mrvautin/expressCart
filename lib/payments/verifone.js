const express = require('express');
const { indexOrders, indexTransactions } = require('../indexing');
const { getId, sendEmail, getEmailTemplate } = require('../common');
const { getPaymentConfig } = require('../config');
const { emptyCart } = require('../cart');
const got = require('got');
const router = express.Router();

// The homepage of the site
router.get('/checkout_return', async (req, res, next) => {
    const db = req.app.db;
    const config = req.app.config;
    const paymentConfig = getPaymentConfig('verifone');
    const base64Auth = Buffer.from(`${paymentConfig.userId}:${paymentConfig.apiKey}`).toString('base64');

    // Get checkoutid from session
    const checkoutId = req.session.verifoneCheckout;

    // Remove checkout from session
    delete req.session.verifoneCheckout;

    // Grab the checkout and the transaction
    let checkoutResponse;
    let transactionResponse;
    try{
        checkoutResponse = await got.get(`${paymentConfig.baseUrl}/oidc/checkout-service/v2/checkout/${checkoutId}`, {
            headers: {
                'content-type': 'application/json',
                Accept: 'application/json',
                Authorization: `Basic ${base64Auth}`
            },
            rejectUnauthorized: false
        });

        // Parse the response
        checkoutResponse = JSON.parse(checkoutResponse.body);

        transactionResponse = await got.get(`${paymentConfig.baseUrl}/oidc/api/v2/transaction/${checkoutResponse.transaction_id}`, {
            headers: {
                'content-type': 'application/json',
                Accept: 'application/json',
                Authorization: `Basic ${base64Auth}`
            },
            rejectUnauthorized: false
        });

        // Parse the response
        transactionResponse = JSON.parse(transactionResponse.body);

        // order status if approved
        let orderStatus = 'Paid';
        let approved = true;
        if(transactionResponse && transactionResponse.status !== 'SALE AUTHORISED'){
            console.log('Declined response payload', checkoutResponse);
            orderStatus = 'Declined';
            approved = false;
        }

        // Create our transaction
        const transaction = await db.transactions.insertOne({
            gateway: 'verifone',
            gatewayReference: checkoutResponse.transaction_id,
            gatewayMessage: transactionResponse.status,
            approved: approved,
            amount: req.session.totalCartAmount,
            currency: paymentConfig.currency,
            customer: getId(req.session.customerId),
            created: new Date()
        });

        const transactionId = transaction.insertedId;

        // Index transactios
        await indexTransactions(req.app);

        const orderDoc = {
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
            orderType: 'Single',
            transaction: transactionId
        };

        // insert order into DB
        try{
            const newDoc = await db.orders.insertOne(orderDoc);

            // get the new ID
            const newId = newDoc.insertedId;

                // Update order to transaction
            await db.transactions.updateOne({
                _id: getId(transactionId)
            }, {
                $set: {
                    order: getId(newId)
                }
            });

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
                    res.redirect(`/payment/${newId}`);
                }else{
                    // redirect to failure
                    req.session.messageType = 'danger';
                    req.session.message = 'Your payment has declined. Please try again';
                    req.session.paymentApproved = false;
                    req.session.paymentDetails = `<p><strong>Order ID: </strong>${newId}
                    </p><p><strong>Transaction ID: </strong> ${transactionId}</p>`;
                    res.redirect(`/payment/${newId}`);
                }
            });
        }catch(ex){
            console.log('Error getting payment response', ex);
            res.status(400).json({ err: 'Your payment has declined. Please try again' });
        }
    }catch(ex){
        console.info('Exception processing payment', ex);
        req.session.messageType = 'danger';
        req.session.message = 'Your payment has declined. Please try again';
        req.session.paymentApproved = false;
        req.session.paymentDetails = '';
        res.redirect('/checkout/payment');
    }
});

module.exports = router;
