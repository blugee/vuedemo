var mongoose = require('mongoose');

var ShapeBrand = require('./ShapeBrand');

var shapeCategorySchema = new mongoose.Schema({
  name: { type: String },
  brands: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ShapeBrand' }]
}, {
  usePushEach: true // mongodb 3.6 + deprecation
});

module.exports = mongoose.model('ShapeCategory', shapeCategorySchema);
