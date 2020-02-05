const express = require('express');
const common = require('../../lib/common');
const { indexOrders } = require('../../lib/indexing');
const router = express.Router();
const unirest = require('unirest');




router.get('/checkout_cancel', (req, res, next) => {
    // return to checkout for adjustment or repayment
    res.redirect('/checkout');
});

router.get('/checkout_return', (req, res, next) => {

  /* @TODO */
  
});

router.post('/checkout_action', (req, res, next) => {

  const blockonomicsConfig = common.getPaymentConfig();
  const config = req.app.config;
  
  var blockonomicsParams = {};
  // get current rate
  unirest
  .get(blockonomicsConfig.hostUrl+blockonomicsConfig.priceApi+config.currencyISO)
  .then((response) => {
    blockonomicsParams.expectedBtc = Math.round(req.session.totalCartAmount / response.body.price * Math.pow(10, 8)) / Math.pow(10, 8);
    // get new address
    unirest
      .post(blockonomicsConfig.hostUrl+blockonomicsConfig.newAddressApi)
      .headers({'Content-Type': 'application/json', 'User-Agent': 'blockonomics','Accept': 'application/json', 'Authorization': 'Bearer ' + blockonomicsConfig.apiKey})
      .then((response) => {
        blockonomicsParams.address = response.body.address;
        req.session.blockonomicsParams = blockonomicsParams;
        res.redirect('/blockonomics_payment');
      })
  })

  
});


module.exports = router;
