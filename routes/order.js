const express = require('express');
const common = require('../lib/common');
const { restrict, checkAccess } = require('../lib/auth');
const { indexOrders } = require('../lib/indexing');
const router = express.Router();

// Show orders
router.get('/admin/orders', restrict, (req, res, next) => {
    const db = req.app.db;

    // Top 10 products
    db.orders.find({}).sort({ 'orderDate': -1 }).limit(10).toArray((err, orders) => {
        if(err){
            console.info(err.stack);
        }

        // If API request, return json
        if(req.apiAuthenticated){
            return res.status(200).json({
                orders
            });
        }

        return res.render('orders', {
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
});

// Admin section
router.get('/admin/orders/bystatus/:orderstatus', restrict, (req, res, next) => {
    const db = req.app.db;

    if(typeof req.params.orderstatus === 'undefined'){
        res.redirect('/admin/orders');
        return;
    }

    // case insensitive search
    let regex = new RegExp(['^', req.params.orderstatus, '$'].join(''), 'i');
    db.orders.find({ orderStatus: regex }).sort({ 'orderDate': -1 }).limit(10).toArray((err, orders) => {
        if(err){
            console.info(err.stack);
        }

        // If API request, return json
        if(req.apiAuthenticated){
            return res.status(200).json({
                orders
            });
        }

        return res.render('orders', {
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
});

// render the editor
router.get('/admin/order/view/:id', restrict, (req, res) => {
    const db = req.app.db;
    db.orders.findOne({ _id: common.getId(req.params.id) }, (err, result) => {
        if(err){
            console.info(err.stack);
        }
        res.render('order', {
            title: 'View order',
            result: result,
            config: req.app.config,
            session: req.session,
            message: common.clearSessionValue(req.session, 'message'),
            messageType: common.clearSessionValue(req.session, 'messageType'),
            editor: true,
            admin: true,
            helpers: req.handlebars.helpers
        });
    });
});

// Admin section
router.get('/admin/orders/filter/:search', restrict, (req, res, next) => {
    const db = req.app.db;
    let searchTerm = req.params.search;
    let ordersIndex = req.app.ordersIndex;

    let lunrIdArray = [];
    ordersIndex.search(searchTerm).forEach((id) => {
        lunrIdArray.push(common.getId(id.ref));
    });

    // we search on the lunr indexes
    db.orders.find({ _id: { $in: lunrIdArray } }).toArray((err, orders) => {
        if(err){
            console.info(err.stack);
        }

        // If API request, return json
        if(req.apiAuthenticated){
            return res.status(200).json({
                orders
            });
        }

        return res.render('orders', {
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
});

// order product
router.get('/admin/order/delete/:id', restrict, (req, res) => {
    const db = req.app.db;

    // remove the order
    db.orders.remove({ _id: common.getId(req.params.id) }, {}, (err, numRemoved) => {
        if(err){
            console.info(err.stack);
        }
        // remove the index
        indexOrders(req.app)
        .then(() => {
            // redirect home
            req.session.message = 'Order successfully deleted';
            req.session.messageType = 'success';
            res.redirect('/admin/orders');
        });
    });
});

// update order status
router.post('/admin/order/statusupdate', restrict, checkAccess, (req, res) => {
    const db = req.app.db;
    db.orders.update({ _id: common.getId(req.body.order_id) }, { $set: { orderStatus: req.body.status } }, { multi: false }, (err, numReplaced) => {
        if(err){
            console.info(err.stack);
            return res.status(400).json({ message: 'Failed to update the order status' });
        }
        return res.status(200).json({ message: 'Status successfully updated' });
    });
});

module.exports = router;
