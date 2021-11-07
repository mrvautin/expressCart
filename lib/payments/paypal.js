const express = require('express');
const { indexOrders, indexTransactions } = require('../indexing');
const { getId, sendEmail, getEmailTemplate } = require('../common');
const { getPaymentConfig } = require('../config');
const { emptyCart } = require('../cart');
const paypal = require('paypal-rest-sdk');
const router = express.Router();

router.get('/checkout_cancel', (req, res, next) => {
    // return to checkout for adjustment or repayment
    res.redirect('/checkout');
});

router.get('/checkout_return', (req, res, next) => {
    const db = req.app.db;
    const config = req.app.config;
    const paypalConfig = getPaymentConfig('paypal');
    const paymentId = req.session.paymentId;
    const payerId = req.query.PayerID;

    const details = { payer_id: payerId };
    paypal.payment.execute(paymentId, details, async(error, payment) => {
        let paymentApproved = false;
        let paymentMessage = '';
        let paymentDetails = '';
        if(error){
            paymentApproved = false;

            if(error.response.name === 'PAYMENT_ALREADY_DONE'){
                paymentApproved = false;
                paymentMessage = error.response.message;
            }else{
                paymentApproved = false;
                paymentDetails = error.response.error_description;
            }

            // set the error
            req.session.messageType = 'danger';
            req.session.message = error.response.error_description;
            req.session.paymentApproved = paymentApproved;
            req.session.paymentDetails = paymentDetails;

            res.redirect(`/payment/${req.session.orderId}`);
            return;
        }

        const paymentOrderId = req.session.orderId;
        let paymentStatus = 'Approved';

        // fully approved
        if(payment.state === 'approved'){
            paymentApproved = true;
            paymentStatus = 'Paid';
            paymentMessage = 'Succeeded';
            paymentDetails = `<p><strong>Order ID: </strong>${paymentOrderId}</p><p><strong>Transaction ID: </strong>${payment.id}</p>`;

            // clear the cart
            if(req.session.cart){
                emptyCart(req, res, 'function');
            }
        }

        // failed
        if(payment.failureReason){
            paymentApproved = false;
            paymentMessage = `Declined: ${payment.failureReason}`;
            paymentStatus = 'Declined';
        }

        // Create our transaction
        const transaction = await db.transactions.insertOne({
            gateway: 'paypal',
            gatewayReference: payment.id,
            gatewayMessage: paymentMessage,
            approved: paymentApproved,
            amount: req.session.totalCartAmount,
            currency: paypalConfig.paypalCurrency,
            customer: getId(req.session.customerId),
            created: new Date(),
            order: getId(paymentOrderId)
        });

        const transactionId = transaction.insertedId;

        // Index transactios
        await indexTransactions(req.app);

        // update the order status
        db.orders.updateOne({ _id: getId(paymentOrderId) }, { $set: { orderStatus: paymentStatus, transaction: transactionId } }, { multi: false }, (err, numReplaced) => {
            if(err){
                console.info(err.stack);
            }
            db.orders.findOne({ _id: getId(paymentOrderId) }, async (err, order) => {
                if(err){
                    console.info(err.stack);
                }

                // add to lunr index
                indexOrders(req.app)
                .then(() => {
                    // set the results
                    req.session.messageType = 'success';
                    req.session.message = paymentMessage;
                    req.session.paymentEmailAddr = order.orderEmail;
                    req.session.paymentApproved = paymentApproved;
                    req.session.paymentDetails = paymentDetails;

                    const paymentResults = {
                        message: req.session.message,
                        messageType: req.session.messageType,
                        paymentEmailAddr: req.session.paymentEmailAddr,
                        paymentApproved: req.session.paymentApproved,
                        paymentDetails: req.session.paymentDetails
                    };

                    // send the email with the response
                    // TODO: Should fix this to properly handle result
                    sendEmail(req.session.paymentEmailAddr, `Your payment with ${config.cartTitle}`, getEmailTemplate(paymentResults));

                    res.redirect(`/payment/${order._id}`);
                });
            });
        });
    });
});

// The homepage of the site
router.post('/checkout_action', (req, res, next) => {
    const db = req.app.db;
    const config = req.app.config;
    const paypalConfig = getPaymentConfig('paypal');

    // setup the payment object
    const payment = {
        intent: 'sale',
        payer: {
            payment_method: 'paypal'
        },
        redirect_urls: {
            return_url: `${config.baseUrl}/paypal/checkout_return`,
            cancel_url: `${config.baseUrl}/paypal/checkout_cancel`
        },
        transactions: [{
            amount: {
                total: req.session.totalCartAmount,
                currency: paypalConfig.paypalCurrency
            },
            description: paypalConfig.paypalCartDescription
        }]
    };

    // set the config
    paypal.configure(paypalConfig);

    // create payment
    paypal.payment.create(payment, async(error, payment) => {
        if(error){
            req.session.message = 'There was an error processing your payment. You have not been charged and can try again.';
            req.session.messageType = 'danger';
            console.log(error);
            res.redirect('/checkout/payment');
            return;
        }
        if(payment.payer.payment_method === 'paypal'){
            req.session.paymentId = payment.id;
            let redirectUrl;
            for(let i = 0; i < payment.links.length; i++){
                const link = payment.links[i];
                if(link.method === 'REDIRECT'){
                    redirectUrl = link.href;
                }
            }

            // if there is no items in the cart then render a failure
            if(!req.session.cart){
                req.session.message = 'The are no items in your cart. Please add some items before checking out';
                req.session.messageType = 'danger';
                res.redirect('/');
                return;
            }

            // new order doc
            const orderDoc = {
                orderPaymentId: payment.id,
                orderPaymentGateway: 'Paypal',
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
                orderStatus: payment.state,
                orderDate: new Date(),
                orderProducts: req.session.cart,
                orderType: 'Single'
            };

            if(req.session.orderId){
                // we have an order ID (probably from a failed/cancelled payment previosuly) so lets use that.

                // send the order to Paypal
                res.redirect(redirectUrl);
            }else{
                // no order ID so we create a new one
                db.orders.insertOne(orderDoc, (err, newDoc) => {
                    if(err){
                        console.info(err.stack);
                    }

                    // get the new ID
                    const newId = newDoc.insertedId;

                    // set the order ID in the session
                    req.session.orderId = newId;

                    // send the order to Paypal
                    res.redirect(redirectUrl);
                });
            }
        }
    });
});

module.exports = router;
