const escape = require('html-entities').AllHtmlEntities;
const{clearSessionValue,
     mongoSanitize,
     getThemes, 
     getId,
    allowedMimeType, 
    fileSizeLimit,
    checkDirectorySync, 
    sendEmail }= require('../lib/common');
const bcrypt = require('bcryptjs');
const {
    getConfig,
    updateConfig
} = require('../lib/config');
const {
    sortMenu,
    getMenu,
    newMenu,
    updateMenu,
    deleteMenu,
    orderMenu
} = require('../lib/menu');



// Admin section
const adminDashboard=( (req, res, next)=>{
    res.redirect('/admin/dashboard');
})
// logout 1
const logout=( (req, res)=>{
    req.session.user = null;
    req.session.message = null;
    req.session.messageType = null;
    res.redirect('/');
})

// login form 2
const login=(async (req, res) => {
    const db = req.app.db;

    const userCount = await db.users.countDocuments({});
    // we check for a user. If one exists, redirect to login form otherwise setup
    if(userCount && userCount > 0){
        // set needsSetup to false as a user exists
        req.session.needsSetup = false;
        res.render('login', {
            title: 'Login',
            referringUrl: req.header('Referer'),
            config: req.app.config,
            message: clearSessionValue(req.session, 'message'),
            messageType: clearSessionValue(req.session, 'messageType'),
            helpers: req.handlebars.helpers,
            showFooter: 'showFooter'
        });
    }else{
        // if there are no users set the "needsSetup" session
        req.session.needsSetup = true;
        res.redirect('/admin/setup');
    }
});

// login the user and check the password 3
const loginValidate=( async (req, res) => {
    const db = req.app.db;

    const user = await db.users.findOne({ userEmail: mongoSanitize(req.body.email) });
    if(!user || user === null){
        res.status(400).json({ message: 'A user with that email does not exist.' });
        return;
    }

    // we have a user under that email so we compare the password
    bcrypt.compare(req.body.password, user.userPassword)
        .then((result) => {
            if(result){
                req.session.user = req.body.email;
                req.session.usersName = user.usersName;
                req.session.userId = user._id.toString();
                req.session.isAdmin = user.isAdmin;
                res.status(200).json({ message: 'Login successful' });
                return;
            }
            // password is not correct
            res.status(400).json({ message: 'Access denied. Check password and try again.' });
        });
});


// setup form is shown when there are no users setup in the DB 4
const adminSetup=(async (req, res) => {
    const db = req.app.db;

    const userCount = await db.users.countDocuments({});
    // dont allow the user to "re-setup" if a user exists.
    // set needsSetup to false as a user exists
    req.session.needsSetup = false;
    if(userCount === 0){
        req.session.needsSetup = true;
        res.render('setup', {
            title: 'Setup',
            config: req.app.config,
            helpers: req.handlebars.helpers,
            message: clearSessionValue(req.session, 'message'),
            messageType: clearSessionValue(req.session, 'messageType'),
            showFooter: 'showFooter'
        });
        return;
    }
    res.redirect('/admin/login');
});



// insert a user 5
const setupUser=(async (req, res) => {   //can convert this to function because it seems the flow of control not entring try catch
    const db = req.app.db;

    const doc = {
        usersName: req.body.usersName,
        userEmail: req.body.userEmail,
        userPassword: bcrypt.hashSync(req.body.userPassword, 10),
        isAdmin: true,
        isOwner: true
    };

    // check for users 
    const userCount = await db.users.countDocuments({});
    if(userCount === 0){
        // email is ok to be used.
        try{
            await db.users.insertOne(doc);
            res.status(200).json({ message: 'User account inserted' });
            return;
        }catch(ex){
            console.error(colors.red(`Failed to insert user: ${ex}`));
            res.status(200).json({ message: 'Setup failed' });
            return;
        }
    }
    res.status(200).json({ message: 'Already setup.' });
});


// dashboard 6
const dashboard=(async (req, res) => {
    const db = req.app.db;

    // Collate data for dashboard
    const dashboardData = {
        productsCount: await db.products.countDocuments({
            productPublished: true
        }),
        ordersCount: await db.orders.countDocuments({}),
        ordersAmount: await db.orders.aggregate([{ $match: {} },
            { $group: { _id: null, sum: { $sum: '$orderTotal' } }
        }]).toArray(),
        productsSold: await db.orders.aggregate([{ $match: {} },
            { $group: { _id: null, sum: { $sum: '$orderProductCount' } }
        }]).toArray(),
        topProducts: await db.orders.aggregate([
            { $project: { _id: 0 } },
            { $project: { o: { $objectToArray: '$orderProducts' } } },
            { $unwind: '$o' },
            { $group: {
                    _id: '$o.v.title',
                    productImage: { $last: '$o.v.productImage' },
                    count: { $sum: '$o.v.quantity' }
            } },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]).toArray()
    };

    // Fix aggregate data
    if(dashboardData.ordersAmount.length > 0){
        dashboardData.ordersAmount = dashboardData.ordersAmount[0].sum;
    }
    if(dashboardData.productsSold.length > 0){
        dashboardData.productsSold = dashboardData.productsSold[0].sum;
    }else{
        dashboardData.productsSold = 0;
    }

    res.render('dashboard', {
        title: 'Cart dashboard',
        session: req.session,
        admin: true,
        dashboardData,
        themes: getThemes(),
        message: clearSessionValue(req.session, 'message'),
        messageType: clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers,
        config: req.app.config,
        csrfToken: req.csrfToken()
    });
});

// settings
const getSettings=((req, res) => {
    res.render('settings', {
        title: 'Cart settings',
        session: req.session,
        admin: true,
        themes: getThemes(),
        message: clearSessionValue(req.session, 'message'),
        messageType: clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers,
        config: req.app.config,
        footerHtml: typeof req.app.config.footerHtml !== 'undefined' ? escape.decode(req.app.config.footerHtml) : null,
        googleAnalytics: typeof req.app.config.googleAnalytics !== 'undefined' ? escape.decode(req.app.config.googleAnalytics) : null,
        csrfToken: req.csrfToken()
    });
});

// create API key
const genAPI=(async (req, res) => {
    const db = req.app.db;
    const result = await db.users.findOneAndUpdate({
        _id: ObjectId(req.session.userId),
        isAdmin: true
    }, {
        $set: {
            apiKey: new ObjectId()
        }
    }, {
        returnOriginal: false
    });

    if(result.value && result.value.apiKey){
        res.status(200).json({ message: 'API Key generated', apiKey: result.value.apiKey });
        return;
    }
    res.status(400).json({ message: 'Failed to generate API Key' });
});

// settings update
function settingsUpdate(req, res) {
    const result = updateConfig(req.body);
    if(result === true){
        req.app.config = getConfig();
        res.status(200).json({ message: 'Settings successfully updated' });
        return;
    }
    res.status(400).json({ message: 'Permission denied' });
};

// settings menu
const settingsMenu=(async (req, res) => {
    const db = req.app.db;
    res.render('settings-menu', {
        title: 'Cart menu',
        session: req.session,
        admin: true,
        message: clearSessionValue(req.session, 'message'),
        messageType: clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers,
        config: req.app.config,
        menu: sortMenu(await getMenu(db)),
        csrfToken: req.csrfToken()
    });
});

module.exports={adminDashboard,
    settingsMenu,
     logout, login, 
     loginValidate,
      adminSetup, 
      setupUser, 
      dashboard, 
      getSettings,
      genAPI, 
      settingsUpdate
    }