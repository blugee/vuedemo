var mongoose = require('mongoose');
var numberHelpers = require('../helpers/numbers');

var Store = require('./Store');
var Part = require('./Part');
var CaseOption = require('./CaseOption');

var priceSchema = new mongoose.Schema({
  value: { type: Number, get: numberHelpers.getPrice, set: numberHelpers.setPrice },
  store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
  part: { type: mongoose.Schema.Types.ObjectId, ref: 'Part' },
  available: { type: Boolean, default: false },
  options: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CaseOption' }],
}, {
  usePushEach: true // mongodb 3.6 + deprecation
});

priceSchema.methods.availability = function() {
  return this.available ? 'available' : 'unavail';
};

module.exports = mongoose.model('Price', priceSchema);
