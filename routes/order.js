const express = require('express');
const common = require('../lib/common');
const { restrict, checkAccess } = require('../lib/auth');
const { indexOrders } = require('../lib/indexing');
const router = express.Router();

// Show orders
router.get('/admin/orders', restrict, async (req, res, next) => {
    const db = req.app.db;

    // Top 10 products
    const orders = await db.orders.find({}).sort({ orderDate: -1 }).limit(10).toArray();

    // If API request, return json
    if(req.apiAuthenticated){
        res.status(200).json({
            orders
        });
        return;
    }

    res.render('orders', {
        title: 'Cart',
        orders: orders,
        admin: true,
        config: req.app.config,
        session: req.session,
        message: common.clearSessionValue(req.session, 'message'),
        messageType: common.clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers
    });
});

// Admin section
router.get('/admin/orders/bystatus/:orderstatus', restrict, async (req, res, next) => {
    const db = req.app.db;

    if(typeof req.params.orderstatus === 'undefined'){
        res.redirect('/admin/orders');
        return;
    }

    // case insensitive search
    const regex = new RegExp(['^', req.params.orderstatus, '$'].join(''), 'i');
    const orders = await db.orders.find({ orderStatus: regex }).sort({ orderDate: -1 }).limit(10).toArray();

    // If API request, return json
    if(req.apiAuthenticated){
        res.status(200).json({
            orders
        });
        return;
    }

    res.render('orders', {
        title: 'Cart',
        orders: orders,
        admin: true,
        filteredOrders: true,
        filteredStatus: req.params.orderstatus,
        config: req.app.config,
        session: req.session,
        message: common.clearSessionValue(req.session, 'message'),
        messageType: common.clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers
    });
});

// render the editor
router.get('/admin/order/view/:id', restrict, async (req, res) => {
    const db = req.app.db;
    const order = await db.orders.findOne({ _id: common.getId(req.params.id) });

    res.render('order', {
        title: 'View order',
        result: order,
        config: req.app.config,
        session: req.session,
        message: common.clearSessionValue(req.session, 'message'),
        messageType: common.clearSessionValue(req.session, 'messageType'),
        editor: true,
        admin: true,
        helpers: req.handlebars.helpers
    });
});

// Admin section
router.get('/admin/orders/filter/:search', restrict, async (req, res, next) => {
    const db = req.app.db;
    const searchTerm = req.params.search;
    const ordersIndex = req.app.ordersIndex;

    const lunrIdArray = [];
    ordersIndex.search(searchTerm).forEach((id) => {
        lunrIdArray.push(common.getId(id.ref));
    });

    // we search on the lunr indexes
    const orders = await db.orders.find({ _id: { $in: lunrIdArray } }).toArray();

    // If API request, return json
    if(req.apiAuthenticated){
        res.status(200).json({
            orders
        });
        return;
    }

    res.render('orders', {
        title: 'Order results',
        orders: orders,
        admin: true,
        config: req.app.config,
        session: req.session,
        searchTerm: searchTerm,
        message: common.clearSessionValue(req.session, 'message'),
        messageType: common.clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers
    });
});

// order product
router.get('/admin/order/delete/:id', restrict, async(req, res) => {
    const db = req.app.db;

    // remove the order
    try{
        await db.orders.deleteOne({ _id: common.getId(req.params.id) });

        // remove the index
        indexOrders(req.app)
        .then(() => {
            if(req.apiAuthenticated){
                res.status(200).json({
                    message: 'Order successfully deleted'
                });
                return;
            }

            // redirect home
            req.session.message = 'Order successfully deleted';
            req.session.messageType = 'success';
            res.redirect('/admin/orders');
        });
    }catch(ex){
        console.log('Cannot delete order', ex);
        if(req.apiAuthenticated){
            res.status(200).json({
                message: 'Error deleting order'
            });
            return;
        }

        // redirect home
        req.session.message = 'Error deleting order';
        req.session.messageType = 'danger';
        res.redirect('/admin/orders');
    }
});

// update order status
router.post('/admin/order/statusupdate', restrict, checkAccess, async (req, res) => {
    const db = req.app.db;
    try{
        await db.orders.updateOne({
            _id: common.getId(req.body.order_id) },
            { $set: { orderStatus: req.body.status }
        }, { multi: false });
        return res.status(200).json({ message: 'Status successfully updated' });
    }catch(ex){
        console.info('Error updating status', ex);
        return res.status(400).json({ message: 'Failed to update the order status' });
    }
});

module.exports = router;
