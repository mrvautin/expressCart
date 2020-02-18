const express = require('express');
const common = require('../../lib/common');
const { indexOrders } = require('../../lib/indexing');
const router = express.Router();
const unirest = require('unirest');




router.get('/checkout_cancel', (req, res, next) => {
    // return to checkout for adjustment or repayment
    res.redirect('/checkout');
});

router.get('/checkout_return', async (req, res, next) => {
  const db = req.app.db;
  var status = req.query.status || -1;
  var address = req.query.addr || 'na';
  var amount = (req.query.value || 0)/1e8;
  var txid = req.query.txid || 'na';

  if (Number(status) == 2) {
    // we are interested only in final confirmations
    const order = await db.orders.findOne({ orderPaymentId: address });
    if (!!order) {
      if (amount >= order.orderExpectedBtc) {
        try{
            await db.orders.updateOne({
                _id: order._id },
                { $set: { orderStatus: 'Paid', orderReceivedBtc: amount, orderBlockonomicsTxid: txid }
            }, { multi: false });
        }catch(ex){
            console.info('Error updating status success blockonomics', ex);
        }        
        return;
      }
      console.info('Amount not sufficient blockonomics', address);
      try{
          await db.orders.updateOne({
              _id: order._id },
              { $set: { orderStatus: 'Declined', orderReceivedBtc: amount }
          }, { multi: false });
      }catch(ex){
          console.info('Error updating status insufficient blockonomics', ex);
      }        
      return;
    }
    console.info('Order not found blockonomics', address);
  }
  console.info('Payment not final blockonomics', address);

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
