"use strict";

var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate');

var Store = require('./Store');

function Url(key, options) {
  mongoose.SchemaType.call(this, key, options, 'Url');
}
Url.prototype = Object.create(mongoose.SchemaType.prototype);

Url.prototype.cast = function(val) {
  var _val = new URL(val);
  return _val.toString();
};

mongoose.Schema.Types.Url = Url;

var Schema = new mongoose.Schema({
  region: { type: String, uppercase: true, trim: true },
  currency: { type: String, default: '$', trim: true },
  baseURL: { type: Url, default: 'https://mycasebuilder.com/', trim: true },
  apiUser: { type: String, trim: true },
  apiKey: {type: String, trim: true}, // from app to CS-Cart
  xAuthToken: {type: String}, // from CS-Cart to the app
  emailSendTime: {type: String},
  timeZone: {type: String}
}, {
  timestamps: true,
  usePushEach: true // mongodb 3.6 + deprecation
});

Schema.plugin(mongoosePaginate);

Schema.pre('save', function(next) {
  this.baseURL = this.baseURL ? this.baseURL.replace(/(^\/|\/$)+/, '') : this.baseURL;
  next();
});

Schema.virtual('stores', {
  ref: 'Store',
  localField: 'region',
  foreignField: 'csCartServerInstance',
  justOne: false
});

var model = mongoose.model('Cart', Schema);

model.collection.ensureIndex({ region: 1}, { unique: true, background: true });

module.exports = model;
