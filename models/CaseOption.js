var mongoose = require('mongoose');
var numberHelpers = require('../helpers/numbers');

var Variant = require('./Variant');

var caseOptionSchema = new mongoose.Schema({
  name: { type: String },
  optionType: { type: String, enum: [
  	'radio',
  	'select',
  	'multi-select',
  	'checkbox',
  	'text-input',
  	'text-area'] },
  choices: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Variant' }],
  help: { type: String },
  // a HTML file to load
  template: { type:String },
  active: { type: Boolean },
  global: { type: Boolean, default: false }
}, {
  usePushEach: true // mongodb 3.6 + deprecation
});

caseOptionSchema.pre('remove', function(next) {
    // 'this' is the client being removed. Provide callbacks here if you want
    // to be notified of the calls' result.
    Sweepstakes.remove({client_id: this._id}).exec();
    Submission.remove({client_id: this._id}).exec();
    next();
});

module.exports = mongoose.model('CaseOption', caseOptionSchema);
