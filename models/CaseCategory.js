var mongoose = require('mongoose');

var caseCategorySchema = new mongoose.Schema({
  name: { type: String } // unique: true
}, {
  usePushEach: true // mongodb 3.6 + deprecation
});

var model = mongoose.model('CaseCategory', caseCategorySchema);

// mongoose has a few bugs with the Schema.index api in 4.6.x
// using the mongodb native api
//
// maintain an index in the background - don't block mongo requests on index generation/update
model.collection.ensureIndex({ name: 1}, { unique: true, background: true });

module.exports = model;
