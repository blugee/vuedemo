var mongoose = require('mongoose');
var numberHelpers = require('../helpers/numbers');

var Price = require('./Price');
var CaseOption = require('./CaseOption');
var Case = require('./Case');


var partSchema = new mongoose.Schema({
  name: { type: String },
  prices: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Price' }],
  options: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CaseOption' }],
  'case': { type: mongoose.Schema.Types.ObjectId, ref: 'Case' }
}, {
  usePushEach: true // mongodb 3.6 + deprecation
});

module.exports = mongoose.model('Part', partSchema);
