module.exports = {
  index: require('./index'),
  admin: require('./admin'),
  product: require('./product'),
  customer: require('./customer'),
  order: require('./order'),
  user: require('./user'),
  paypal: require('./payments/paypal'),
  stripe: require('./payments/stripe'),
  authorizenet: require('./payments/authorizenet')
};
