const express = require('express');
const { restrict } = require('../lib/auth');
const ObjectId = require('mongodb').ObjectID;
const {
    getId,
    clearSessionValue
} = require('../lib/common');
const { paginateData } = require('../lib/paginate');
const router = express.Router();

router.get('/admin/transactions/:page?', restrict, async (req, res, next) => {
    let pageNum = 1;
    if(req.params.page){
        pageNum = req.params.page;
    }

    // Get our paginated data
    const transactions = await paginateData(false, req, pageNum, 'transactions', {}, { created: -1 });

    res.render('transactions', {
        title: 'Cart - Rransactions',
        results: transactions.data,
        totalItemCount: transactions.totalItems,
        pageNum,
        paginateUrl: 'admin/transactions',
        resultType: 'top',
        session: req.session,
        admin: true,
        config: req.app.config,
        message: clearSessionValue(req.session, 'message'),
        messageType: clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers
    });
});

router.get('/admin/transactions/filter/:search', restrict, async (req, res, next) => {
    const db = req.app.db;
    const searchTerm = req.params.search;
    const transactionsIndex = req.app.transactionsIndex;

    const lunrIdArray = [];
    transactionsIndex.search(searchTerm).forEach((id) => {
        lunrIdArray.push(getId(id.ref));
    });

    // we search on the lunr indexes
    const results = await db.transactions.find({ _id: { $in: lunrIdArray } }).sort({ created: -1 }).toArray();

    if(req.apiAuthenticated){
        res.status(200).json(results);
        return;
    }

    res.render('transactions', {
        title: 'Transactions',
        results: results,
        resultType: 'filtered',
        admin: true,
        config: req.app.config,
        session: req.session,
        searchTerm: searchTerm,
        message: clearSessionValue(req.session, 'message'),
        messageType: clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers
    });
});

router.get('/admin/transaction/:id', restrict, async (req, res, next) => {
    const db = req.app.db;

    // we search on the lunr indexes
    const transaction = await db.transactions.findOne({ _id: ObjectId(req.params.id) });

    if(req.apiAuthenticated){
        res.status(200).json(transaction);
        return;
    }

    res.render('transaction', {
        title: 'Transaction',
        result: transaction,
        resultType: 'filtered',
        admin: true,
        config: req.app.config,
        session: req.session,
        message: clearSessionValue(req.session, 'message'),
        messageType: clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers
    });
});

module.exports = router;
