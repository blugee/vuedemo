var mongoose = require('mongoose');

var User = require('./User');
var Design = require('./Design');
var Revision = require('./Revision');

var designSchema = new mongoose.Schema({
  'owners': [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  uniqueID: { type: String },
  revisions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Revision' }],
  currentRev: { type: mongoose.Schema.Types.ObjectId, ref: 'Revision' },
  name: { type: String },
  chatID: { type: String },
  softDelete: { type: Date },
  shareable: { type: Boolean, default: false },
  locked: { type: Boolean, default: false },
  softLocked: { type: Boolean },
  copyOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Design' },
  isTemplate: { type: Boolean, default: false },
  basedOnTemplate: { type: String },
  csCartPublicDesignId: { type: Number }
},{
	timestamps: true,
  usePushEach: true // mongodb 3.6 + deprecation
});

designSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

designSchema.index({ name: 1 }, { background: true });
designSchema.index({ name: 'text' });

var model = mongoose.model('Design', designSchema);

// mongoose has a few bugs with the Schema.index api in 4.6.x
// using the mongodb native api
//
// maintain an index in the background - don't block mongo requests on index generation/update
model.collection.ensureIndex({ uniqueID: 1}, { unique: true, background: true });
model.collection.ensureIndex({ currentRev: 1 }, { background: true });
model.collection.ensureIndex({ revisions: 1 }, { background: true });
model.collection.ensureIndex({ owners: 1 }, { background: true });
model.collection.ensureIndex({ copyOf: 1 }, { background: true });

module.exports = model;
