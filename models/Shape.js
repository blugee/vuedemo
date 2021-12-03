var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate');

var User = require('./User');
var Shape = require('./Shape');
var ShapeBrand = require('./ShapeBrand');
var ShapeCategory = require('./ShapeCategory');
var ShapeOrientation = require('./ShapeOrientation');


var shapeSchema = new mongoose.Schema({
  name: { type: String },
  mfrID: { type: String },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'ShapeCategory' },
  brand: { type: mongoose.Schema.Types.ObjectId, ref: 'ShapeBrand' },
  available: { type: Boolean, default: true },
  related: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Shape' }],
  orientations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ShapeOrientation' }],
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sharedUsers: [{ type: String, lowercase: true }],  // accepts email addresses
  open: { type: Boolean, default: true },
  thumb: { type: String },
  thumbMime: { type: String },
  thumbPath: { type: String },
  newImage: { type: String },
  desc: { type: String },
  verified: { type: Boolean, default: true }
}, {
  usePushEach: true // mongodb 3.6 + deprecation
});

shapeSchema.plugin(mongoosePaginate);

shapeSchema.index({ sharedUsers: 1, owner: 1, available: 1 }, { background: true });
shapeSchema.index({ owner: 1 }, { background: true });
shapeSchema.index({ available: 1 }, { background: true });
shapeSchema.index({ sharedUsers: 1 }, { background: true });
shapeSchema.index({ name: 'text', desc: 'text' });

shapeSchema.virtual('more').get(function() {
  return 'more';
});

shapeSchema.methods.toJSON = function() {
  var obj = this.toObject();
  return obj;
};

module.exports = mongoose.model('Shape', shapeSchema);
