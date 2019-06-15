const express = require('express');
const common = require('../lib/common');
const { restrict } = require('../lib/auth');
const colors = require('colors');
const bcrypt = require('bcryptjs');
const url = require('url');
const router = express.Router();

router.get('/admin/users', restrict, (req, res) => {
    const db = req.app.db;
    db.users.find({}).toArray((err, users) => {
        if(err){
            console.info(err.stack);
        }
        res.render('users', {
            title: 'Users',
            users: users,
            admin: true,
            config: req.app.config,
            isAdmin: req.session.isAdmin,
            helpers: req.handlebars.helpers,
            session: req.session,
            message: common.clearSessionValue(req.session, 'message'),
            messageType: common.clearSessionValue(req.session, 'messageType')
        });
    });
});

// edit user
router.get('/admin/user/edit/:id', restrict, (req, res) => {
    const db = req.app.db;
    db.users.findOne({ _id: common.getId(req.params.id) }, (err, user) => {
        if(err){
            console.info(err.stack);
        }
        // if the user we want to edit is not the current logged in user and the current user is not
        // an admin we render an access denied message
        if(user.userEmail !== req.session.user && req.session.isAdmin === false){
            req.session.message = 'Access denied';
            req.session.messageType = 'danger';
            res.redirect('/Users/');
            return;
        }

        res.render('user_edit', {
            title: 'User edit',
            user: user,
            admin: true,
            session: req.session,
            message: common.clearSessionValue(req.session, 'message'),
            messageType: common.clearSessionValue(req.session, 'messageType'),
            helpers: req.handlebars.helpers,
            config: req.app.config
        });
    });
});

// users new
router.get('/admin/user/new', restrict, (req, res) => {
    res.render('user_new', {
        title: 'User - New',
        admin: true,
        session: req.session,
        helpers: req.handlebars.helpers,
        message: common.clearSessionValue(req.session, 'message'),
        messageType: common.clearSessionValue(req.session, 'messageType'),
        config: req.app.config
    });
});

// delete user
router.get('/admin/user/delete/:id', restrict, (req, res) => {
    const db = req.app.db;
    if(req.session.isAdmin === true){
        db.users.remove({ _id: common.getId(req.params.id) }, {}, (err, numRemoved) => {
            if(err){
                console.info(err.stack);
            }
            req.session.message = 'User deleted.';
            req.session.messageType = 'success';
            res.redirect('/admin/users');
        });
    }else{
        req.session.message = 'Access denied.';
        req.session.messageType = 'danger';
        res.redirect('/admin/users');
    }
});

// update a user
router.post('/admin/user/update', restrict, (req, res) => {
    const db = req.app.db;

    let isAdmin = req.body.user_admin === 'on';

    // get the user we want to update
    db.users.findOne({ _id: common.getId(req.body.userId) }, (err, user) => {
        if(err){
            console.info(err.stack);
        }

        // If the current user changing own account ensure isAdmin retains existing
        if(user.userEmail === req.session.user){
            isAdmin = user.isAdmin;
        }

        // if the user we want to edit is not the current logged in user and the current user is not
        // an admin we render an access denied message
        if(user.userEmail !== req.session.user && req.session.isAdmin === false){
            req.session.message = 'Access denied';
            req.session.messageType = 'danger';
            res.redirect('/admin/users/');
            return;
        }

        // create the update doc
        let updateDoc = {};
        updateDoc.isAdmin = isAdmin;
        updateDoc.usersName = req.body.usersName;
        if(req.body.userPassword){
            updateDoc.userPassword = bcrypt.hashSync(req.body.userPassword);
        }

        db.users.update({ _id: common.getId(req.body.userId) },
            {
                $set: updateDoc
            }, { multi: false }, (err, numReplaced) => {
                if(err){
                    console.error(colors.red('Failed updating user: ' + err));
                    req.session.message = 'Failed to update user';
                    req.session.messageType = 'danger';
                    res.redirect('/admin/user/edit/' + req.body.userId);
                }else{
                    // show the view
                    req.session.message = 'User account updated.';
                    req.session.messageType = 'success';
                    res.redirect('/admin/user/edit/' + req.body.userId);
                }
            });
    });
});

// insert a user
router.post('/admin/user/insert', restrict, (req, res) => {
    const db = req.app.db;

    // set the account to admin if using the setup form. Eg: First user account
    let urlParts = url.parse(req.header('Referer'));

    // Check number of users
    db.users.count({}, (err, userCount) => {
        let isAdmin = false;

        // if no users, setup user as admin
        if(userCount === 0){
            isAdmin = true;
        }

        let doc = {
            usersName: req.body.usersName,
            userEmail: req.body.userEmail,
            userPassword: bcrypt.hashSync(req.body.userPassword, 10),
            isAdmin: isAdmin
        };

        // check for existing user
        db.users.findOne({ 'userEmail': req.body.userEmail }, (err, user) => {
            if(user){
                // user already exists with that email address
                console.error(colors.red('Failed to insert user, possibly already exists: ' + err));
                req.session.message = 'A user with that email address already exists';
                req.session.messageType = 'danger';
                res.redirect('/admin/user/new');
                return;
            }
            // email is ok to be used.
            db.users.insert(doc, (err, doc) => {
                // show the view
                if(err){
                    if(doc){
                        console.error(colors.red('Failed to insert user: ' + err));
                        req.session.message = 'User exists';
                        req.session.messageType = 'danger';
                        res.redirect('/admin/user/edit/' + doc._id);
                        return;
                    }
                    console.error(colors.red('Failed to insert user: ' + err));
                    req.session.message = 'New user creation failed';
                    req.session.messageType = 'danger';
                    res.redirect('/admin/user/new');
                    return;
                }
                req.session.message = 'User account inserted';
                req.session.messageType = 'success';

                // if from setup we add user to session and redirect to login.
                // Otherwise we show users screen
                if(urlParts.path === '/admin/setup'){
                    req.session.user = req.body.userEmail;
                    res.redirect('/admin/login');
                    return;
                }
                res.redirect('/admin/users');
            });
        });
    });
});

module.exports = router;
