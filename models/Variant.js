var mongoose = require('mongoose');
var numberHelpers = require('../helpers/numbers');

var variantSchema = new mongoose.Schema({
  name: { type:String },
  //extra cost
  modifier: { type: Number, get: numberHelpers.getPrice, set: numberHelpers.setPrice, default: 0 },
  modifierType: { type: String, enum: [ 'money','percent' ]},
  active: { type: Boolean, default: false }
}, {
  usePushEach: true // mongodb 3.6 + deprecation
});

module.exports = mongoose.model('Variant', variantSchema);
