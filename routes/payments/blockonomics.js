const express = require('express');
const common = require('../../lib/common');
const { indexOrders } = require('../../lib/indexing');
const stripe = require('stripe')(common.getPaymentConfig().secretKey);
const router = express.Router();


router.get('/checkout_cancel', (req, res, next) => {
    // return to checkout for adjustment or repayment
    res.redirect('/checkout');
});

router.get('/checkout_return', (req, res, next) => {

  /* @TODO */
  
});

router.post('/checkout_action', (req, res, next) => {

  /* @TODO @WIP */
  const blockonomicsConfig = common.getPaymentConfig();
  console.log(blockonomicsConfig);

  
});


module.exports = router;
