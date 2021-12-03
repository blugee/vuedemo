var mongoose = require('mongoose');

var Case = require('./Case');

var inCaseShapeSchema = new mongoose.Schema({
  name: { type: String },
  case: { type: mongoose.Schema.Types.ObjectId, ref: 'Case' },
  width: { type: Number },
  length: { type: Number },
  xx: { type: Number },
  yy: { type: Number },
  height: { type: Number },
  rounded: { type: Boolean },
  data: { type: String },
  fromBottom: { type: Number }
}, {
  usePushEach: true // mongodb 3.6 + deprecation
});

module.exports = mongoose.model('InCaseShape', inCaseShapeSchema);
