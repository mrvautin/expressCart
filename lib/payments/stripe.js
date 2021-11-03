const express = require('express');
const { indexOrders } = require('../indexing');
const { getId, sendEmail, getEmailTemplate } = require('../common');
const { getPaymentConfig } = require('../config');
const { emptyCart } = require('../cart');
const numeral = require('numeral');
const stripe = require('stripe')(getPaymentConfig().secretKey);
const router = express.Router();

router.post('/setup', async (req, res, next) => {
    const stripeConfig = getPaymentConfig('stripe');
    const stripe = require('stripe')(stripeConfig.secretKey);

    const paymentIntent = await stripe.paymentIntents.create({
        amount: numeral(req.session.totalCartAmount).format('0.00').replace('.', ''),
        currency: stripeConfig.stripeCurrency,
        payment_method_types: stripeConfig.paymentMethods
    });
    res.send({
        clientSecret: paymentIntent.client_secret
    });
});

router.get('/checkout_action', async (req, res, next) => {
    const db = req.app.db;
    const config = req.app.config;
    const stripeConfig = getPaymentConfig('stripe');
    const stripe = require('stripe')(stripeConfig.secretKey);

    // Get result
    const result = req.query;

    // Check for the result
    if(!result || !result.payment_intent){
        req.session.messageType = 'danger';
        req.session.message = 'Unable to retrieve the payment.';
        res.redirect('/checkout/payment');
        return;
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(
        result.payment_intent
    );

    // Check for payment intent
    if(!paymentIntent){
        req.session.messageType = 'danger';
        req.session.message = 'Unable to retrieve the payment.';
        res.redirect('/checkout/payment');
        return;
    }

    // order status
    let paymentStatus = 'Paid';
    if(paymentIntent.status !== 'succeeded'){
        paymentStatus = 'Declined';
    }

    // new order doc
    const orderDoc = {
        orderPaymentId: paymentIntent.id,
        orderPaymentGateway: 'Stripe',
        orderPaymentMessage: paymentIntent.status,
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
    const orderId = newOrder.insertedId;

    // add to lunr index
    indexOrders(req.app)
    .then(() => {
        // if approved, send email etc
        if(paymentIntent.status === 'succeeded'){
            // set the results
            req.session.messageType = 'success';
            req.session.message = 'Your payment was successfully completed';
            req.session.paymentEmailAddr = orderDoc.orderEmail;
            req.session.paymentApproved = true;
            req.session.paymentDetails = `<p><strong>Order ID: </strong>${orderId}</p><p><strong>Transaction ID: </strong>${paymentIntent.id}</p>`;

            // set payment results for email
            const paymentResults = {
                paymentId: orderId,
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

            // Return the outcome
            res.redirect(`/payment/${orderId}`);
            return;
        }
        // Return failure
        req.session.messageType = 'danger';
        req.session.message = 'Your payment has declined. Please try again';
        req.session.paymentApproved = false;
        req.session.paymentDetails = `<p><strong>Order ID: </strong>${orderId}</p><p><strong>Transaction ID: </strong>${paymentIntent.id}</p>`;
        res.redirect(`/payment/${orderId}`);
    });
});

// Subscription hook from Stripe
router.all('/subscription_update', async (req, res, next) => {
    const db = req.app.db;
    const stripeSigSecret = getPaymentConfig('stripe').stripeWebhookSecret;
    const stripeSig = req.headers['stripe-signature'];

    let hook;
    if(stripeSigSecret){
        try{
            hook = await stripe.webhooks.constructEvent(req.rawBody, stripeSig, stripeSigSecret);
            console.info('Stripe Webhook received');
        }catch(err){
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        if(!hook.data.object.customer){
            return res.status(400).json({ message: 'Customer not found' });
        }
    }else{
        hook = req.body;
    }

    const order = await db.orders.findOne({
        orderCustomer: hook.data.object.customer,
        orderType: 'Subscription'
    });

    if(!order){
        return res.status(400).json({ message: 'Order not found' });
    }

    let orderStatus = 'Paid';
    if(hook.type === 'invoice.payment_failed'){
        orderStatus = 'Declined';
    }

    // Update order status
    await db.orders.updateOne({
        _id: getId(order._id),
        orderType: 'Subscription'
    }, {
        $set: {
            orderStatus: orderStatus
        }
    });

    return res.status(200).json({ message: 'Status successfully updated' });
});

router.post('/checkout_action_subscription', async (req, res, next) => {
    const db = req.app.db;
    const config = req.app.config;

    try{
        const plan = await stripe.plans.retrieve(req.body.stripePlan);
        if(!plan){
            req.session.messageType = 'danger';
            req.session.message = 'The plan connected to this product doesn\'t exist';
            res.redirect('/checkout/payment');
            return;
        }
    }catch(ex){
        req.session.messageType = 'danger';
        req.session.message = 'The plan connected to this product doesn\'t exist';
        res.redirect('/checkout/payment');
        return;
    }

    // Create customer
    const customer = await stripe.customers.create({
        source: req.body.stripeToken,
        plan: req.body.stripePlan,
        email: req.body.shipEmail,
        name: `${req.body.shipFirstname} ${req.body.shipLastname}`,
        phone: req.body.shipPhoneNumber
    });

    if(!customer){
        req.session.messageType = 'danger';
        req.session.message = 'Your subscripton has declined. Please try again';
        req.session.paymentApproved = false;
        req.session.paymentDetails = '';
        res.redirect('/checkout/payment');
        return;
    }

    // Check for a subscription
    if(customer.subscriptions.data && customer.subscriptions.data.length === 0){
        req.session.messageType = 'danger';
        req.session.message = 'Your subscripton has declined. Please try again';
        req.session.paymentApproved = false;
        req.session.paymentDetails = '';
        res.redirect('/checkout/payment');
        return;
    }

    const subscription = customer.subscriptions.data[0];

    // Create the new order document
    const orderDoc = {
        orderPaymentId: subscription.id,
        orderPaymentGateway: 'Stripe',
        orderPaymentMessage: subscription.collection_method,
        orderTotal: req.session.totalCartAmount,
        orderShipping: req.session.totalCartShipping,
        orderItemCount: req.session.totalCartItems,
        orderProductCount: req.session.totalCartProducts,
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
        orderType: 'Subscription',
        orderCustomer: customer.id
    };

    // insert order into DB
    const order = await db.orders.insertOne(orderDoc);
    const orderId = order.insertedId;

    indexOrders(req.app)
    .then(() => {
        // set the results
        req.session.messageType = 'success';
        req.session.message = 'Your subscription was successfully created';
        req.session.paymentEmailAddr = req.body.shipEmail;
        req.session.paymentApproved = true;
        req.session.paymentDetails = `<p><strong>Order ID: </strong>${orderId}</p><p><strong>Subscription ID: </strong>${subscription.id}</p>`;

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
        sendEmail(req.session.paymentEmailAddr, `Your payment with ${config.cartTitle}`, getEmailTemplate(paymentResults));

        // redirect to outcome
        res.redirect(`/payment/${orderId}`);
    });
});

module.exports = router;
