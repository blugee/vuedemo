var mongoose = require('mongoose');

var ShapeCategory = require('./ShapeCategory');

var shapeBrandSchema = new mongoose.Schema({
  name: { type: String },
  categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ShapeCategory' }]
},{
  usePushEach: true // mongodb 3.6 + deprecation
});

module.exports = mongoose.model('ShapeBrand', shapeBrandSchema);
