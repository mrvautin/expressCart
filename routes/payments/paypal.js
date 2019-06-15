let express = require('express');
let common = require('../../lib/common');
const { indexOrders } = require('../../lib/indexing');
let paypal = require('paypal-rest-sdk');
let router = express.Router();

router.get('/checkout_cancel', (req, res, next) => {
    // return to checkout for adjustment or repayment
    res.redirect('/checkout');
});

router.get('/checkout_return', (req, res, next) => {
    let db = req.app.db;
    let config = req.app.config;
    let paymentId = req.session.paymentId;
    let payerId = req.query['PayerID'];

    let details = { 'payer_id': payerId };
    paypal.payment.execute(paymentId, details, (error, payment) => {
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

            res.redirect('/payment/' + req.session.orderId);
            return;
        }

        let paymentOrderId = req.session.orderId;
        let paymentStatus = 'Approved';

        // fully approved
        if(payment.state === 'approved'){
            paymentApproved = true;
            paymentStatus = 'Paid';
            paymentMessage = 'Your payment was successfully completed';
            paymentDetails = '<p><strong>Order ID: </strong>' + paymentOrderId + '</p><p><strong>Transaction ID: </strong>' + payment.id + '</p>';

            // clear the cart
            if(req.session.cart){
                req.session.cart = null;
                req.session.orderId = null;
                req.session.totalCartAmount = 0;
            }
        }

        // failed
        if(payment.failureReason){
            paymentApproved = false;
            paymentMessage = 'Your payment failed - ' + payment.failureReason;
            paymentStatus = 'Declined';
        }

        // update the order status
        db.orders.update({ _id: common.getId(paymentOrderId) }, { $set: { orderStatus: paymentStatus } }, { multi: false }, (err, numReplaced) => {
            if(err){
                console.info(err.stack);
            }
            db.orders.findOne({ _id: common.getId(paymentOrderId) }, (err, order) => {
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

                    let paymentResults = {
                        message: req.session.message,
                        messageType: req.session.messageType,
                        paymentEmailAddr: req.session.paymentEmailAddr,
                        paymentApproved: req.session.paymentApproved,
                        paymentDetails: req.session.paymentDetails
                    };

                    // send the email with the response
                    // TODO: Should fix this to properly handle result
                    common.sendEmail(req.session.paymentEmailAddr, 'Your payment with ' + config.cartTitle, common.getEmailTemplate(paymentResults));

                    res.redirect('/payment/' + order._id);
                });
            });
        });
    });
});

// The homepage of the site
router.post('/checkout_action', (req, res, next) => {
    let db = req.app.db;
    let config = req.app.config;
    let paypalConfig = common.getPaymentConfig();

    // setup the payment object
    let payment = {
        'intent': 'sale',
        'payer': {
            'payment_method': 'paypal'
        },
        'redirect_urls': {
            'return_url': config.baseUrl + '/paypal/checkout_return',
            'cancel_url': config.baseUrl + '/paypal/checkout_cancel'
        },
        'transactions': [{
            'amount': {
                'total': req.session.totalCartAmount,
                'currency': paypalConfig.paypalCurrency
            },
            'description': paypalConfig.paypalCartDescription
        }]
    };

    // set the config
    paypal.configure(paypalConfig);

    // create payment
    paypal.payment.create(payment, (error, payment) => {
        if(error){
            req.session.message = 'There was an error processing your payment. You have not been changed and can try again.';
            req.session.messageType = 'danger';
            res.redirect('/pay');
            return;
        }
        if(payment.payer.payment_method === 'paypal'){
            req.session.paymentId = payment.id;
            let redirectUrl;
            for(let i = 0; i < payment.links.length; i++){
                let link = payment.links[i];
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
            let orderDoc = {
                orderPaymentId: payment.id,
                orderPaymentGateway: 'Paypal',
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
                orderStatus: payment.state,
                orderDate: new Date(),
                orderProducts: req.session.cart
            };

            if(req.session.orderId){
                // we have an order ID (probably from a failed/cancelled payment previosuly) so lets use that.

                // send the order to Paypal
                res.redirect(redirectUrl);
            }else{
                // no order ID so we create a new one
                db.orders.insert(orderDoc, (err, newDoc) => {
                    if(err){
                        console.info(err.stack);
                    }

                    // get the new ID
                    let newId = newDoc.insertedIds['0'];

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
