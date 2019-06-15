const express = require('express');
const router = express.Router();
const colors = require('colors');
const randtoken = require('rand-token');
const bcrypt = require('bcryptjs');
const common = require('../lib/common');
const { restrict } = require('../lib/auth');

// insert a customer
router.post('/customer/create', (req, res) => {
    const db = req.app.db;

    let doc = {
        email: req.body.email,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        address1: req.body.address1,
        address2: req.body.address2,
        country: req.body.country,
        state: req.body.state,
        postcode: req.body.postcode,
        phone: req.body.phone,
        password: bcrypt.hashSync(req.body.password, 10),
        created: new Date()
    };

    // check for existing customer
    db.customers.findOne({ email: req.body.email }, (err, customer) => {
        if(customer){
            res.status(400).json({
                err: 'A customer already exists with that email address'
            });
            return;
        }
        // email is ok to be used.
        db.customers.insertOne(doc, (err, newCustomer) => {
            if(err){
                if(newCustomer){
                    console.error(colors.red('Failed to insert customer: ' + err));
                    res.status(400).json({
                        err: 'A customer already exists with that email address'
                    });
                    return;
                }
                console.error(colors.red('Failed to insert customer: ' + err));
                res.status(400).json({
                    err: 'Customer creation failed.'
                });
                return;
            }

            // Customer creation successful
            req.session.customer = newCustomer.ops[0];
            res.status(200).json({
                message: 'Successfully logged in',
                customer: newCustomer
            });
        });
    });
});

// render the customer view
router.get('/admin/customer/view/:id?', restrict, (req, res) => {
    const db = req.app.db;

    db.customers.findOne({ _id: common.getId(req.params.id) }, (err, customer) => {
        if(err){
            console.info(err.stack);
        }

        // If API request, return json
        if(req.apiAuthenticated){
            return res.status(200).json(customer);
        }

        return res.render('customer', {
            title: 'View customer',
            result: customer,
            admin: true,
            session: req.session,
            message: common.clearSessionValue(req.session, 'message'),
            messageType: common.clearSessionValue(req.session, 'messageType'),
            config: req.app.config,
            editor: true,
            helpers: req.handlebars.helpers
        });
    });
});

// customers list
router.get('/admin/customers', restrict, (req, res) => {
    const db = req.app.db;

    db.customers.find({}).limit(20).sort({ created: -1 }).toArray((err, customers) => {
        // If API request, return json
        if(req.apiAuthenticated){
            return res.status(200).json(customers);
        }

        return res.render('customers', {
            title: 'Customers - List',
            admin: true,
            customers: customers,
            session: req.session,
            helpers: req.handlebars.helpers,
            message: common.clearSessionValue(req.session, 'message'),
            messageType: common.clearSessionValue(req.session, 'messageType'),
            config: req.app.config
        });
    });
});

// Filtered customers list
router.get('/admin/customers/filter/:search', restrict, (req, res, next) => {
    const db = req.app.db;
    let searchTerm = req.params.search;
    let customersIndex = req.app.customersIndex;

    let lunrIdArray = [];
    customersIndex.search(searchTerm).forEach((id) => {
        lunrIdArray.push(common.getId(id.ref));
    });

    // we search on the lunr indexes
    db.customers.find({ _id: { $in: lunrIdArray } }).sort({ created: -1 }).toArray((err, customers) => {
        if(err){
            console.error(colors.red('Error searching', err));
        }

        // If API request, return json
        if(req.apiAuthenticated){
            return res.status(200).json({
                customers
            });
        }

        return res.render('customers', {
            title: 'Customer results',
            customers: customers,
            admin: true,
            config: req.app.config,
            session: req.session,
            searchTerm: searchTerm,
            message: common.clearSessionValue(req.session, 'message'),
            messageType: common.clearSessionValue(req.session, 'messageType'),
            helpers: req.handlebars.helpers
        });
    });
});

// login the customer and check the password
router.post('/customer/login_action', async (req, res) => {
    let db = req.app.db;

    db.customers.findOne({email: common.mongoSanitize(req.body.loginEmail)}, (err, customer) => { // eslint-disable-line
        if(err){
            // An error accurred
            return res.status(400).json({
                message: 'Access denied. Check password and try again.'
            });
        }

        // check if customer exists with that email
        if(customer === undefined || customer === null){
            return res.status(400).json({
                message: 'A customer with that email does not exist.'
            });
        }
        // we have a customer under that email so we compare the password
        bcrypt.compare(req.body.loginPassword, customer.password)
        .then((result) => {
            if(!result){
                // password is not correct
                return res.status(400).json({
                    message: 'Access denied. Check password and try again.'
                });
            }

            // Customer login successful
            req.session.customer = customer;
            return res.status(200).json({
                message: 'Successfully logged in',
                customer: customer
            });
        })
        .catch((err) => {
            return res.status(400).json({
                message: 'Access denied. Check password and try again.'
            });
        });
    });
});

// customer forgotten password
router.get('/customer/forgotten', (req, res) => {
    res.render('forgotten', {
        title: 'Forgotten',
        route: 'customer',
        forgotType: 'customer',
        config: req.app.config,
        helpers: req.handlebars.helpers,
        message: common.clearSessionValue(req.session, 'message'),
        messageType: common.clearSessionValue(req.session, 'messageType'),
        showFooter: 'showFooter'
    });
});

// forgotten password
router.post('/customer/forgotten_action', (req, res) => {
    const db = req.app.db;
    const config = req.app.config;
    let passwordToken = randtoken.generate(30);

    // find the user
    db.customers.findOne({ email: req.body.email }, (err, customer) => {
        // if we have a customer, set a token, expiry and email it
        if(customer){
            let tokenExpiry = Date.now() + 3600000;
            db.customers.update({ email: req.body.email }, { $set: { resetToken: passwordToken, resetTokenExpiry: tokenExpiry } }, { multi: false }, (err, numReplaced) => {
                // send forgotten password email
                let mailOpts = {
                    to: req.body.email,
                    subject: 'Forgotten password request',
                    body: `You are receiving this because you (or someone else) have requested the reset of the password for your user account.\n\n
                        Please click on the following link, or paste this into your browser to complete the process:\n\n
                        ${config.baseUrl}/customer/reset/${passwordToken}\n\n
                        If you did not request this, please ignore this email and your password will remain unchanged.\n`
                };

                // send the email with token to the user
                // TODO: Should fix this to properly handle result
                common.sendEmail(mailOpts.to, mailOpts.subject, mailOpts.body);
                req.session.message = 'An email has been sent to ' + req.body.email + ' with further instructions';
                req.session.message_type = 'success';
                return res.redirect('/customer/forgotten');
            });
        }else{
            req.session.message = 'Account does not exist';
            res.redirect('/customer/forgotten');
        }
    });
});

// reset password form
router.get('/customer/reset/:token', (req, res) => {
    const db = req.app.db;

    // Find the customer using the token
    db.customers.findOne({ resetToken: req.params.token, resetTokenExpiry: { $gt: Date.now() } }, (err, customer) => {
        if(!customer){
            req.session.message = 'Password reset token is invalid or has expired';
            req.session.message_type = 'danger';
            res.redirect('/forgot');
            return;
        }

        // show the password reset form
        res.render('reset', {
            title: 'Reset password',
            token: req.params.token,
            route: 'customer',
            config: req.app.config,
            message: common.clearSessionValue(req.session, 'message'),
            message_type: common.clearSessionValue(req.session, 'message_type'),
            show_footer: 'show_footer',
            helpers: req.handlebars.helpers
        });
    });
});

// reset password action
router.post('/customer/reset/:token', (req, res) => {
    const db = req.app.db;

    // get the customer
    db.customers.findOne({ resetToken: req.params.token, resetTokenExpiry: { $gt: Date.now() } }, (err, customer) => {
        if(!customer){
            req.session.message = 'Password reset token is invalid or has expired';
            req.session.message_type = 'danger';
            return res.redirect('/forgot');
        }

        // update the password and remove the token
        let newPassword = bcrypt.hashSync(req.body.password, 10);
        db.customers.update({ email: customer.email }, { $set: { password: newPassword, resetToken: undefined, resetTokenExpiry: undefined } }, { multi: false }, (err, numReplaced) => {
            let mailOpts = {
                to: customer.email,
                subject: 'Password successfully reset',
                body: 'This is a confirmation that the password for your account ' + customer.email + ' has just been changed successfully.\n'
            };

            // TODO: Should fix this to properly handle result
            common.sendEmail(mailOpts.to, mailOpts.subject, mailOpts.body);
            req.session.message = 'Password successfully updated';
            req.session.message_type = 'success';
            return res.redirect('/pay');
        });
        return'';
    });
});

// logout the customer
router.post('/customer/logout', (req, res) => {
    req.session.customer = null;
    res.status(200).json({});
});

module.exports = router;
