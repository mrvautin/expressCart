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
  console.log(req.query);
  // confirm order and then on frontend redirect to http://de.selfand.com:1111/payment/5e42e1811e047d7a3de11563
});

router.post('/checkout_action', (req, res, next) => {

  const blockonomicsConfig = common.getPaymentConfig();
  const config = req.app.config;
  const db = req.app.db;
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
          blockonomicsParams.timestamp = Math.floor(new Date() / 1000);
          // create order with status Pending and save ref
        
            const orderDoc = {
                orderPaymentId: blockonomicsParams.address,
                orderPaymentGateway: 'Blockonomics',
                orderExpectedBtc: blockonomicsParams.expectedBtc,
                orderTotal: req.session.totalCartAmount,
                orderShipping: req.session.totalCartShipping,
                orderItemCount: req.session.totalCartItems,
                orderProductCount: req.session.totalCartProducts,
                orderEmail: req.session.customerEmail,
                orderFirstname: req.session.customerFirstname,
                orderLastname: req.session.customerLastname,
                orderAddr1: req.session.customerAddress1,
                orderAddr2: req.session.customerAddress2,
                orderCountry: req.session.customerCountry,
                orderState: req.session.customerState,
                orderPostcode: req.session.customerPostcode,
                orderPhoneNumber: req.session.customerPhone,
                orderComment: req.session.orderComment,
                orderStatus: 'Pending',
                orderDate: new Date(),
                orderProducts: req.session.cart,
                orderType: 'Single'
            };        
            db.orders.insertOne(orderDoc, (err, newDoc) => {
                if(err){
                    console.info(err.stack);
                }
                // get the new ID
                const newId = newDoc.insertedId;

                // set the order ID in the session, to link to it from blockonomics payment page
                blockonomicsParams.pendingOrderId = newId;
                req.session.blockonomicsParams = blockonomicsParams;
                res.redirect('/blockonomics_payment');
            });        
        


      })
  })

  
});


module.exports = router;
