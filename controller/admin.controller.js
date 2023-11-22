const{clearSessionValue} = require('../lib/common');
// Admin section
const adminDashboard=( (req, res, next)=>{
    res.redirect('/admin/dashboard');
})
// logout
const logout=( (req, res)=>{
    req.session.user = null;
    req.session.message = null;
    req.session.messageType = null;
    res.redirect('/');
})

// login form
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


module.exports={adminDashboard, logout, login}