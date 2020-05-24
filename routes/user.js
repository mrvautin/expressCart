const express = require('express');
const { restrict } = require('../lib/auth');
const { getId, clearSessionValue } = require('../lib/common');
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
        message: clearSessionValue(req.session, 'message'),
        messageType: clearSessionValue(req.session, 'messageType')
    });
});

// edit user
router.get('/admin/user/edit/:id', restrict, async (req, res) => {
    const db = req.app.db;
    const user = await db.users.findOne({ _id: getId(req.params.id) });

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

    res.render('user-edit', {
        title: 'User edit',
        user: user,
        admin: true,
        session: req.session,
        message: clearSessionValue(req.session, 'message'),
        messageType: clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers,
        config: req.app.config
    });
});

// users new
router.get('/admin/user/new', restrict, (req, res) => {
    res.render('user-new', {
        title: 'User - New',
        admin: true,
        session: req.session,
        helpers: req.handlebars.helpers,
        message: clearSessionValue(req.session, 'message'),
        messageType: clearSessionValue(req.session, 'messageType'),
        config: req.app.config
    });
});

// delete a user
router.post('/admin/user/delete', restrict, async (req, res) => {
    const db = req.app.db;

    // userId
    if(req.session.isAdmin !== true){
        res.status(400).json({ message: 'Access denied' });
        return;
    }

    // Cannot delete your own account
    if(req.session.userId === req.body.userId){
        res.status(400).json({ message: 'Unable to delete own user account' });
        return;
    }

    const user = await db.users.findOne({ _id: getId(req.body.userId) });

    // If user is not found
    if(!user){
        res.status(400).json({ message: 'User not found.' });
        return;
    }

    // Cannot delete the original user/owner
    if(user.isOwner){
        res.status(400).json({ message: 'Access denied.' });
        return;
    }

    try{
        await db.users.deleteOne({ _id: getId(req.body.userId) }, {});
        res.status(200).json({ message: 'User deleted.' });
        return;
    }catch(ex){
        console.log('Failed to delete user', ex);
        res.status(200).json({ message: 'Cannot delete user' });
        return;
    };
});

// update a user
router.post('/admin/user/update', restrict, async (req, res) => {
    const db = req.app.db;

    let isAdmin = req.body.userAdmin === 'on';

    // get the user we want to update
    const user = await db.users.findOne({ _id: getId(req.body.userId) });

    // If user not found
    if(!user){
        res.status(400).json({ message: 'User not found' });
        return;
    }

    // If the current user changing own account ensure isAdmin retains existing
    if(user.userEmail === req.session.user){
        isAdmin = user.isAdmin;
    }

    // if the user we want to edit is not the current logged in user and the current user is not
    // an admin we render an access denied message
    if(user.userEmail !== req.session.user && req.session.isAdmin === false){
        res.status(400).json({ message: 'Access denied' });
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
        res.status(400).json({
            message: 'Failed to create user. Check inputs.',
            error: schemaResult.errors
        });
        return;
    }

    try{
        const updatedUser = await db.users.findOneAndUpdate(
            { _id: getId(req.body.userId) },
            {
                $set: updateDoc
            }, { multi: false, returnOriginal: false }
        );

        const returnUser = updatedUser.value;
        delete returnUser.userPassword;
        delete returnUser.apiKey;
        res.status(200).json({ message: 'User account updated', user: updatedUser.value });
        return;
    }catch(ex){
        console.error(colors.red(`Failed updating user: ${ex}`));
        res.status(400).json({ message: 'Failed to update user' });
    }
});

// insert a user
router.post('/admin/user/insert', restrict, async (req, res) => {
    const db = req.app.db;

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
        res.status(400).json({ message: 'Failed to create user. Check inputs.', error: schemaResult.errors });
        return;
    }

    // check for existing user
    const user = await db.users.findOne({ userEmail: req.body.userEmail });
    if(user){
        console.error(colors.red('Failed to insert user, possibly already exists'));
        res.status(400).json({ message: 'A user with that email address already exists' });
        return;
    }
    // email is ok to be used.
    try{
        const newUser = await db.users.insertOne(userObj);
        res.status(200).json({
            message: 'User account inserted',
            userId: newUser.insertedId
        });
    }catch(ex){
        console.error(colors.red(`Failed to insert user: ${ex}`));
        res.status(400).json({ message: 'New user creation failed' });
    }
});

module.exports = router;
