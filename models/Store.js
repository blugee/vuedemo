const mongoose = require('mongoose');
const ObjectId = require('mongoose').Types.ObjectId;
const mongoosePaginate = require('mongoose-paginate');

var Cart = require('./Cart');
var Price = require('./Price');
var Case = require('./Case');

var storeSchema = new mongoose.Schema({
  name: { type: String },
  prices: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Price' }],
  cases: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Case' }],
  ezID: { type: String }, // unique: true
  checkoutURL: { type: String },
  logoURL: { type: String },
  hasCustomLogo: { type: Boolean },
  logoImg: { type: String },
  logoImgWidth: { type: String },
  hasOwnCheckout: { type: Boolean },
  headerHTML: { type: String },
  checkoutVariables: { type: String },
  requestType: { type: String },
  adminEmail: { type: String },
  shouldEmailAdmin: { type: Boolean, default: false },
  estDaysToShip: { type: Number },
  csCartID: { type: Number },
  csCartServerInstance: { type: String },
  isRegionalParent: { type: Boolean, default: false }
}, {
  timestamps: true,
  usePushEach: true // mongodb 3.6 + deprecation
});

storeSchema.virtual('isRegionalAffiliate').get(function(){
  return !this.isRegionalParent;
});

storeSchema.virtual('csCartServer', {
  ref: 'Cart',
  localField: 'csCartServerInstance',
  foreignField: 'region',
  justOne: true
});

storeSchema.plugin(mongoosePaginate);

var model = mongoose.model('Store', storeSchema);

// mongoose has a few bugs with the Schema.index api in 4.6.x
// using the mongodb native api
//
// maintain an index in the background - don't block mongo requests on index generation/update
model.collection.ensureIndex({ ezID: 1}, { unique: true, background: true });
model.collection.ensureIndex({ name: 1}, { background: true });
model.collection.ensureIndex({ cases: 1}, { background: true });
model.collection.ensureIndex({ prices: 1}, { background: true });

module.exports = model;
