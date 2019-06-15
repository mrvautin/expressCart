let express = require('express');
let common = require('../../lib/common');
const { indexOrders } = require('../../lib/indexing');
let numeral = require('numeral');
let stripe = require('stripe')(common.getPaymentConfig().secretKey);
let router = express.Router();

// The homepage of the site
router.post('/checkout_action', (req, res, next) => {
    let db = req.app.db;
    let config = req.app.config;
    let stripeConfig = common.getPaymentConfig();

    // charge via stripe
    stripe.charges.create({
        amount: numeral(req.session.totalCartAmount).format('0.00').replace('.', ''),
        currency: stripeConfig.stripeCurrency,
        source: req.body.stripeToken,
        description: stripeConfig.stripeDescription
    }, (err, charge) => {
        if(err){
            console.info(err.stack);
            req.session.messageType = 'danger';
            req.session.message = 'Your payment has declined. Please try again';
            req.session.paymentApproved = false;
            req.session.paymentDetails = '';
            res.redirect('/pay');
            return;
        }

        // order status
        let paymentStatus = 'Paid';
        if(charge.paid !== true){
            paymentStatus = 'Declined';
        }

        // new order doc
        let orderDoc = {
            orderPaymentId: charge.id,
            orderPaymentGateway: 'Stripe',
            orderPaymentMessage: charge.outcome.seller_message,
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
            orderProducts: req.session.cart
        };

        // insert order into DB
        db.orders.insert(orderDoc, (err, newDoc) => {
            if(err){
                console.info(err.stack);
            }

            // get the new ID
            let newId = newDoc.insertedIds['0'];

            // add to lunr index
            indexOrders(req.app)
            .then(() => {
                // if approved, send email etc
                if(charge.paid === true){
                    // set the results
                    req.session.messageType = 'success';
                    req.session.message = 'Your payment was successfully completed';
                    req.session.paymentEmailAddr = newDoc.ops[0].orderEmail;
                    req.session.paymentApproved = true;
                    req.session.paymentDetails = '<p><strong>Order ID: </strong>' + newId + '</p><p><strong>Transaction ID: </strong>' + charge.id + '</p>';

                    // set payment results for email
                    let paymentResults = {
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

                    // redirect to outcome
                    res.redirect('/payment/' + newId);
                }else{
                    // redirect to failure
                    req.session.messageType = 'danger';
                    req.session.message = 'Your payment has declined. Please try again';
                    req.session.paymentApproved = false;
                    req.session.paymentDetails = '<p><strong>Order ID: </strong>' + newId + '</p><p><strong>Transaction ID: </strong>' + charge.id + '</p>';
                    res.redirect('/payment/' + newId);
                }
            });
        });
    });
});

module.exports = router;
