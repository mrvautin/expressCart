const express = require('express');
const common = require('../lib/common');
const { restrict } = require('../lib/auth');
const colors = require('colors');
const bcrypt = require('bcryptjs');
const { validateJson } = require('../lib/schema');
const router = express.Router();

router.get('/admin/users', restrict, async (req, res) => {
    const db = req.app.db;
    const users = await db.users.find({}, { projection: { userPassword: 0 } }).toArray();

    if(req.apiAuthenticated){
        res.status(200).json(users);
        return;
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

// edit user
router.get('/admin/user/edit/:id', restrict, async (req, res) => {
    const db = req.app.db;
    const user = await db.users.findOne({ _id: common.getId(req.params.id) });

    // Check user is found
    if(!user){
        if(req.apiAuthenticated){
            res.status(400).json({ message: 'User not found' });
            return;
        }

        req.session.message = 'User not found';
        req.session.messageType = 'danger';
        res.redirect('/admin/users');
        return;
    }

    // if the user we want to edit is not the current logged in user and the current user is not
    // an admin we render an access denied message
    if(user.userEmail !== req.session.user && req.session.isAdmin === false){
        if(req.apiAuthenticated){
            res.status(400).json({ message: 'Access denied' });
            return;
        }

        req.session.message = 'Access denied';
        req.session.messageType = 'danger';
        res.redirect('/admin/users');
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
router.get('/admin/user/delete/:id', restrict, async (req, res) => {
    const db = req.app.db;

    // userId
    if(req.session.isAdmin !== true){
        if(req.apiAuthenticated){
            res.status(400).json({ message: 'Access denied' });
            return;
        }

        req.session.message = 'Access denied.';
        req.session.messageType = 'danger';
        res.redirect('/admin/users');
        return;
    }

    // Cannot delete your own account
    if(req.session.userId === req.params.id){
        if(req.apiAuthenticated){
            res.status(400).json({ message: 'Unable to delete own user account' });
            return;
        }

        req.session.message = 'Unable to delete own user account.';
        req.session.messageType = 'danger';
        res.redirect('/admin/users');
        return;
    }

    const user = await db.users.findOne({ _id: common.getId(req.params.id) });

    // If user is not found
    if(!user){
        if(req.apiAuthenticated){
            res.status(400).json({ message: 'User not found.' });
            return;
        }

        req.session.message = 'User not found.';
        req.session.messageType = 'danger';
        res.redirect('/admin/users');
        return;
    }

    // Cannot delete the original user/owner
    if(user.isOwner){
        if(req.apiAuthenticated){
            res.status(400).json({ message: 'Access denied.' });
            return;
        }

        req.session.message = 'Access denied.';
        req.session.messageType = 'danger';
        res.redirect('/admin/users');
        return;
    }

    try{
        await db.users.deleteOne({ _id: common.getId(req.params.id) }, {});
        if(req.apiAuthenticated){
            res.status(200).json({ message: 'User deleted.' });
            return;
        }
        req.session.message = 'User deleted.';
        req.session.messageType = 'success';
        res.redirect('/admin/users');
    }catch(ex){
        console.log('Failed to delete user', ex);
        if(req.apiAuthenticated){
            res.status(200).json({ message: 'Cannot delete user' });
            return;
        }
        req.session.message = 'Cannot delete user';
        req.session.messageType = 'danger';
        res.redirect('/admin/users');
    };
});

// update a user
router.post('/admin/user/update', restrict, async (req, res) => {
    const db = req.app.db;

    let isAdmin = req.body.user_admin === 'on';

    // get the user we want to update
    const user = await db.users.findOne({ _id: common.getId(req.body.userId) });

    // If user not found
    if(!user){
        if(req.apiAuthenticated){
            res.status(400).json({ message: 'User not found' });
            return;
        }

        req.session.message = 'User not found';
        req.session.messageType = 'danger';
        res.redirect('/admin/users');
        return;
    }

    // If the current user changing own account ensure isAdmin retains existing
    if(user.userEmail === req.session.user){
        isAdmin = user.isAdmin;
    }

    // if the user we want to edit is not the current logged in user and the current user is not
    // an admin we render an access denied message
    if(user.userEmail !== req.session.user && req.session.isAdmin === false){
        if(req.apiAuthenticated){
            res.status(400).json({ message: 'Access denied' });
            return;
        }

        req.session.message = 'Access denied';
        req.session.messageType = 'danger';
        res.redirect('/admin/users');
        return;
    }

    // create the update doc
    const updateDoc = {};
    updateDoc.isAdmin = isAdmin;
    if(req.body.usersName){
        updateDoc.usersName = req.body.usersName;
    }
    if(req.body.userEmail){
        updateDoc.userEmail = req.body.userEmail;
    }
    if(req.body.userPassword){
        updateDoc.userPassword = bcrypt.hashSync(req.body.userPassword);
    }

    // Validate update user
    const schemaResult = validateJson('editUser', updateDoc);
    if(!schemaResult.result){
        if(req.apiAuthenticated){
            res.status(400).json(schemaResult.errors);
            return;
        }
        req.session.message = 'Please check your inputs.';
        req.session.messageType = 'danger';
        res.redirect('/admin/user/edit/' + req.body.userId);
        return;
    }

    try{
        const updatedUser = await db.users.findOneAndUpdate(
            { _id: common.getId(req.body.userId) },
            {
                $set: updateDoc
            }, { multi: false, returnOriginal: false }
        );
        if(req.apiAuthenticated){
            const returnUser = updatedUser.value;
            delete returnUser.userPassword;
            delete returnUser.apiKey;
            res.status(200).json({ message: 'User account updated', user: updatedUser.value });
            return;
        }
        // show the view
        req.session.message = 'User account updated';
        req.session.messageType = 'success';
        res.redirect('/admin/user/edit/' + req.body.userId);
    }catch(ex){
        console.error(colors.red('Failed updating user: ' + ex));
        if(req.apiAuthenticated){
            res.status(400).json({ message: 'Failed to update user' });
            return;
        }
        req.session.message = 'Failed to update user';
        req.session.messageType = 'danger';
        res.redirect('/admin/user/edit/' + req.body.userId);
    }
});

// insert a user
router.post('/admin/user/insert', restrict, async (req, res) => {
    const db = req.app.db;

    // set the account to admin if using the setup form. Eg: First user account
    const urlParts = req.get('Referrer');

    // Check number of users
    const userCount = await db.users.countDocuments({});
    let isAdmin = false;

    // if no users, setup user as admin
    if(userCount === 0){
        isAdmin = true;
    }

    const userObj = {
        usersName: req.body.usersName,
        userEmail: req.body.userEmail,
        userPassword: bcrypt.hashSync(req.body.userPassword, 10),
        isAdmin: isAdmin
    };

    // Validate new user
    const schemaResult = validateJson('newUser', userObj);
    if(!schemaResult.result){
        if(req.apiAuthenticated){
            res.status(400).json(schemaResult.errors);
            return;
        }
        req.session.message = 'Invalid new user. Please check your inputs.';
        req.session.messageType = 'danger';
        res.redirect('/admin/user/new');
        return;
    }

    // check for existing user
    const user = await db.users.findOne({ userEmail: req.body.userEmail });
    if(user){
        if(req.apiAuthenticated){
            res.status(400).json({ message: 'A user with that email address already exists' });
            return;
        }
        // user already exists with that email address
        console.error(colors.red('Failed to insert user, possibly already exists'));
        req.session.message = 'A user with that email address already exists';
        req.session.messageType = 'danger';
        res.redirect('/admin/user/new');
        return;
    }
    // email is ok to be used.
    try{
        await db.users.insertOne(userObj);
        // if from setup we add user to session and redirect to login.
        // Otherwise we show users screen
        if(urlParts && urlParts.path === '/admin/setup'){
            req.session.user = req.body.userEmail;
            res.redirect('/admin/login');
            return;
        }
        if(req.apiAuthenticated){
            res.status(200).json({ message: 'User account inserted' });
            return;
        }

        req.session.message = 'User account inserted';
        req.session.messageType = 'success';
        res.redirect('/admin/users');
    }catch(ex){
        console.error(colors.red('Failed to insert user: ' + ex));
        if(req.apiAuthenticated){
            res.status(400).json({ message: 'New user creation failed' });
            return;
        }
        req.session.message = 'New user creation failed';
        req.session.messageType = 'danger';
        res.redirect('/admin/user/new');
    }
});

module.exports = router;
