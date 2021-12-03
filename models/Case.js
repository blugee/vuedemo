/**
 * prices: A case has many prices.
 *         Each price has a store and a case
 *         Similar to a has_many :through in ruby on rails
**/

var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate');

var Part = require('./Part');
var InCaseShape = require('./InCaseShape');
var CaseCategory = require('./CaseCategory');

var caseSchema = new mongoose.Schema({
  available: { type: Boolean },
  mcbid: { type: String, lowercase: true },
  name: { type: String },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'CaseCategory' },
  categoryString: { type: String },
  brandString: { type: String },
  length: { type: Number },
  width: { type: Number },
  lowerLength: { type: Number },
  lowerWidth: { type: Number },
  baseDepth: { type: Number },
  totalDepth: { type: Number },
  borderWidth: { type: Number },
  cornerRadius: { type: Number },
  outerRule: { type: String },
  inCaseShapes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'InCaseShape' }],
  parts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Part' }],
  csCartMainImg: { type: String },
  csCartProductIDs: { type: mongoose.Schema.Types.Mixed },
}, {
  timestamps: true,
  usePushEach: true // mongodb 3.6 + deprecation
});

caseSchema.plugin(mongoosePaginate);

function getPrice(num){
  var price = (num/100).toFixed(2);
  return isNaN(price) ? 0 : price;
}

function setPrice(num){
  var price = num*100;
  return isNaN(price) ? 0 : price;
}

var model = mongoose.model('Case', caseSchema);

// mongoose has a few bugs with the Schema.index api in 4.6.x
// using the mongodb native api
//
// maintain an index in the background - don't block mongo requests on index generation/update
model.collection.ensureIndex({ mcbid: 1}, { unique: true, background: true });
model.collection.ensureIndex({ name: 1}, { background: true });


module.exports = model;
