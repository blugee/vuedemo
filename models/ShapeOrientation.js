var mongoose = require('mongoose');

var Shape = require('./Shape');

var shapeOrientationSchema = new mongoose.Schema({
  name: { type: String },
  data: { type: String },
  shape: { type: mongoose.Schema.Types.ObjectId, ref: 'Shape' },
  unitToPixelRatio: { type: Number },
  length: { type: Number },
  width: { type: Number },
  depth: { type: Number },
  thumb: { type: String },
  newImage: { type: String },
  thumbMime: { type:String }
}, {
	collection: 'shape_orientations',
  usePushEach: true // mongodb 3.6 + deprecation
});

module.exports = mongoose.model('ShapeOrientation', shapeOrientationSchema);
