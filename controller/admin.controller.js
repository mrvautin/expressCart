

const adminDashboard=( (req, res, next)=>{
    res.redirect('/admin/dashboard');
})

const logout=( (req, res)=>{
    req.session.user = null;
    req.session.message = null;
    req.session.messageType = null;
    res.redirect('/');
})



module.exports={adminDashboard,logout}