/*
 * Unit Tests
 *
 */

// Dependencies
var helpers = require('../lib/helpers.js');
var assert = require('assert');

// Holder for Tests
var unit = {};


// assert that multiplier funcion will return a number
unit['helpers.passwordStrength should return '+helpers.PASSWORD_STRENGTH.STRONG] = function(done){
  var val = helpers.passwordStrength('!@#$&%&(XSDureo12.sd)');
  assert.equal(val, helpers.PASSWORD_STRENGTH.STRONG);
  done();
};


// assert that multiplier funcion will return a number
unit['helpers.passwordStrength should return '+helpers.PASSWORD_STRENGTH.MEDIUM] = function(done){
  var val = helpers.passwordStrength('83hd##');
  assert.equal(val, helpers.PASSWORD_STRENGTH.MEDIUM);
  done();
};


// assert that multiplier funcion will return a number
unit['helpers.passwordStrength should return '+helpers.PASSWORD_STRENGTH.WEAK] = function(done){
  var val = helpers.passwordStrength('adebayo');
  assert.equal(val, helpers.PASSWORD_STRENGTH.WEAK);
  done();
};

// Export the tests to the runner
module.exports = unit;
