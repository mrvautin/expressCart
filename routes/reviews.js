const express = require('express');
const { restrict, checkAccess } = require('../lib/auth');
const {
    getId,
    clearSessionValue
} = require('../lib/common');
const { paginateData } = require('../lib/paginate');
const router = express.Router();

router.get('/admin/reviews/:page?', restrict, async (req, res, next) => {
    let pageNum = 1;
    if(req.params.page){
        pageNum = req.params.page;
    }

    // Get our paginated data
    const reviews = await paginateData(false, req, pageNum, 'reviews', {}, { date: -1 });

    res.render('reviews', {
        title: 'Cart - Reviews',
        results: reviews.data,
        totalItemCount: reviews.totalItems,
        pageNum,
        paginateUrl: 'admin/reviews',
        resultType: 'top',
        session: req.session,
        admin: true,
        config: req.app.config,
        message: clearSessionValue(req.session, 'message'),
        messageType: clearSessionValue(req.session, 'messageType'),
        helpers: req.handlebars.helpers
    });
});

router.get('/admin/reviews/filter/:search', restrict, async (req, res, next) => {
    const db = req.app.db;
    const searchTerm = req.params.search;
    const reviewsIndex = req.app.reviewsIndex;

    const lunrIdArray = [];
    reviewsIndex.search(searchTerm).forEach((id) => {
        lunrIdArray.push(getId(id.ref));
    });

    // we search on the lunr indexes
    const results = await db.reviews.find({ _id: { $in: lunrIdArray } }).toArray();

    if(req.apiAuthenticated){
        res.status(200).json(results);
        return;
    }

    res.render('reviews', {
        title: 'Results',
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

// Remove a product review
router.post('/admin/review/delete', restrict, checkAccess, async (req, res) => {
    const db = req.app.db;

    const review = await db.reviews.findOne({ _id: getId(req.body.reviewId) });
    if(!review){
        res.status(400).json({ message: 'Failed to delete product review' });
        return;
    }

    try{
        // Delete the review
        await db.reviews.deleteOne({ _id: review._id }, {});
        res.status(200).json({ message: 'Successfully deleted review' });
    }catch(ex){
        res.status(400).json({ message: 'Failed to delete review. Please try again' });
    }
});

module.exports = router;
