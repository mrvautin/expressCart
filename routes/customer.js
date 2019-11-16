const express = require('express');
const router = express.Router();
const colors = require('colors');
const randtoken = require('rand-token');
const bcrypt = require('bcryptjs');
const common = require('../lib/common');
const { indexCustomers } = require('../lib/indexing');
const { validateJson } = require('../lib/schema');
const { restrict } = require('../lib/auth');

// insert a customer
router.post('/customer/create', async (req, res) => {
    const db = req.app.db;

    const customerObj = {
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

    const schemaResult = validateJson('newCustomer', customerObj);
    if(!schemaResult.result){
        res.status(400).json(schemaResult.errors);
        return;
    }

    // check for existing customer
    const customer = await db.customers.findOne({ email: req.body.email });
    if(customer){
        res.status(400).json({
            err: 'A customer already exists with that email address'
        });
        return;
    }
    // email is ok to be used.
    try{
        const newCustomer = await db.customers.insertOne(customerObj);
        indexCustomers(req.app)
        .then(() => {
            // Customer creation successful
            req.session.customer = newCustomer.insertedId;
            const customerReturn = newCustomer.ops[0];
            delete customerReturn.password;
            res.status(200).json(customerReturn);
        });
    }catch(ex){
        console.error(colors.red('Failed to insert customer: ', ex));
        res.status(400).json({
            err: 'Customer creation failed.'
        });
    }
});

// Update a customer
router.post('/admin/customer/update', restrict, async (req, res) => {
    const db = req.app.db;

    const customerObj = {
        email: req.body.email,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        address1: req.body.address1,
        address2: req.body.address2,
        country: req.body.country,
        state: req.body.state,
        postcode: req.body.postcode,
        phone: req.body.phone
    };

    // Handle optional values
    if(req.body.password){ customerObj.password = bcrypt.hashSync(req.body.password, 10); }

    const schemaResult = validateJson('editCustomer', customerObj);
    if(!schemaResult.result){
        console.log('errors', schemaResult.errors);
        if(req.apiAuthenticated){
            res.status(400).json(schemaResult.errors);
            return;
        }
        req.session.message = 'Unable to update customer. Check input values';
        req.session.messageType = 'danger';
        res.redirect('/admin/customer/view/' + req.body.customerId);
        return;
    }

    // check for existing customer
    const customer = await db.customers.findOne({ _id: common.getId(req.body.customerId) });
    if(!customer){
        if(req.apiAuthenticated){
            res.status(400).json({
                err: 'Customer not found'
            });
            return;
        }

        req.session.message = 'Customer not found';
        req.session.messageType = 'danger';
        res.redirect('/admin/customer/view/' + req.body.customerId);
        return;
    }
    // Update customer
    try{
        const updatedCustomer = await db.customers.findOneAndUpdate(
            { _id: common.getId(req.body.customerId) },
            {
                $set: customerObj
            }, { multi: false, returnOriginal: false }
        );
        indexCustomers(req.app)
        .then(() => {
            if(req.apiAuthenticated){
                const returnCustomer = updatedCustomer.value;
                delete returnCustomer.password;
                res.status(200).json({ message: 'Customer updated', customer: updatedCustomer.value });
                return;
            }
            // show the view
            req.session.message = 'Customer updated';
            req.session.messageType = 'success';
            res.redirect('/admin/customer/view/' + req.body.customerId);
        });
    }catch(ex){
        console.error(colors.red('Failed updating customer: ' + ex));
        if(req.apiAuthenticated){
            res.status(400).json({ message: 'Failed to update customer' });
            return;
        }
        req.session.message = 'Failed to update customer';
        req.session.messageType = 'danger';
        res.redirect('/admin/customer/view/' + req.body.userId);
    }
});

// render the customer view
router.get('/admin/customer/view/:id?', restrict, async (req, res) => {
    const db = req.app.db;

    const customer = await db.customers.findOne({ _id: common.getId(req.params.id) });

    if(!customer){
         // If API request, return json
        if(req.apiAuthenticated){
            return res.status(400).json({ message: 'Customer not found' });
        }
        req.session.message = 'Customer not found';
        req.session.message_type = 'danger';
        return res.redirect('/admin/customers');
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

// customers list
router.get('/admin/customers', restrict, async (req, res) => {
    const db = req.app.db;

    const customers = await db.customers.find({}).limit(20).sort({ created: -1 }).toArray();

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

// Filtered customers list
router.get('/admin/customers/filter/:search', restrict, async (req, res, next) => {
    const db = req.app.db;
    const searchTerm = req.params.search;
    const customersIndex = req.app.customersIndex;

    const lunrIdArray = [];
    customersIndex.search(searchTerm).forEach((id) => {
        lunrIdArray.push(common.getId(id.ref));
    });

    // we search on the lunr indexes
    const customers = await db.customers.find({ _id: { $in: lunrIdArray } }).sort({ created: -1 }).toArray();

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

// login the customer and check the password
router.post('/customer/login_action', async (req, res) => {
    const db = req.app.db;

    const customer = await db.customers.findOne({ email: common.mongoSanitize(req.body.loginEmail) });
    // check if customer exists with that email
    if(customer === undefined || customer === null){
        res.status(400).json({
            message: 'A customer with that email does not exist.'
        });
        return;
    }
    // we have a customer under that email so we compare the password
    bcrypt.compare(req.body.loginPassword, customer.password)
    .then((result) => {
        if(!result){
            // password is not correct
            res.status(400).json({
                message: 'Access denied. Check password and try again.'
            });
            return;
        }

        // Customer login successful
        req.session.customer = customer;
        res.status(200).json({
            message: 'Successfully logged in',
            customer: customer
        });
    })
    .catch((err) => {
        res.status(400).json({
            message: 'Access denied. Check password and try again.'
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
router.post('/customer/forgotten_action', async (req, res) => {
    const db = req.app.db;
    const config = req.app.config;
    const passwordToken = randtoken.generate(30);

    // find the user
    const customer = await db.customers.findOne({ email: req.body.email });
    // if we have a customer, set a token, expiry and email it
    if(!customer){
        req.session.message = 'Account does not exist';
        req.session.message_type = 'danger';
        res.redirect('/customer/forgotten');
        return;
    }
    try{
        const tokenExpiry = Date.now() + 3600000;
        await db.customers.updateOne({ email: req.body.email }, { $set: { resetToken: passwordToken, resetTokenExpiry: tokenExpiry } }, { multi: false });
        // send forgotten password email
        const mailOpts = {
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
        res.redirect('/customer/forgotten');
    }catch(ex){
        req.session.message = 'Account does not exist';
        req.session.message_type = 'danger';
        res.redirect('/customer/forgotten');
    }
});

// reset password form
router.get('/customer/reset/:token', async (req, res) => {
    const db = req.app.db;

    // Find the customer using the token
    const customer = await db.customers.findOne({ resetToken: req.params.token, resetTokenExpiry: { $gt: Date.now() } });
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

// reset password action
router.post('/customer/reset/:token', async (req, res) => {
    const db = req.app.db;

    // get the customer
    const customer = await db.customers.findOne({ resetToken: req.params.token, resetTokenExpiry: { $gt: Date.now() } });
    if(!customer){
        req.session.message = 'Password reset token is invalid or has expired';
        req.session.message_type = 'danger';
        return res.redirect('/forgot');
    }

    // update the password and remove the token
    const newPassword = bcrypt.hashSync(req.body.password, 10);
    try{
        await db.customers.updateOne({ email: customer.email }, { $set: { password: newPassword, resetToken: undefined, resetTokenExpiry: undefined } }, { multi: false });
        const mailOpts = {
            to: customer.email,
            subject: 'Password successfully reset',
            body: 'This is a confirmation that the password for your account ' + customer.email + ' has just been changed successfully.\n'
        };

        // TODO: Should fix this to properly handle result
        common.sendEmail(mailOpts.to, mailOpts.subject, mailOpts.body);
        req.session.message = 'Password successfully updated';
        req.session.message_type = 'success';
        return res.redirect('/pay');
    }catch(ex){
        console.log('Unable to reset password', ex);
        req.session.message = 'Unable to reset password';
        req.session.message_type = 'danger';
        return res.redirect('/forgot');
    }
});

// logout the customer
router.post('/customer/logout', (req, res) => {
    req.session.customer = null;
    res.status(200).json({});
});

module.exports = router;
