var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate');

var Case = require('./Case');
var Store = require('./Store');
var Revision = require('./Revision');


var CounterSchema = new mongoose.Schema({
    _id: {type: String, required: true},
    seq: { type: Number, default: 100000 }
});
var counter = mongoose.model('counter', CounterSchema);

var nameSchema = new mongoose.Schema({
  first: {type: String, default: ""},
  last: {type: String, default: ""}
}, {
  _id: false,
  minimize: false
});

var publicDesignSchema = new mongoose.Schema({
  isCandidate: {type: Boolean, default: false},
  isScheduled: {type: Boolean, default: false},
  isSent: {type: Boolean, default: false},
  scheduledSendDate: {type: Date, default: null},
  agendaJobId: {type: mongoose.Schema.Types.ObjectId, default: null},
  caseType: {type: String, default: null},
  caseTypeOther: {type: String, default: null},
  name: {
    type: nameSchema,
    default: () => ({ /* triggers default object population via the sub-schema definition */ })
  },
  orderNumber: {type: String, default: null}
}, {
  _id: false,
  minimize: false
});

var customSizeSchema = new mongoose.Schema({
  length: { type: Number },
  width: { type: Number },
  lowerLength: { type: Number },
  lowerWidth: { type: Number },
  baseDepth: { type: Number },
  totalDepth: { type: Number },
  cornerRadius: { type: Number }
}, {
  _id: false
});

var revisionSchema = new mongoose.Schema({
  name: { type: String },
  data: { type: String },
  layers: { type: mongoose.Schema.Types.Mixed },
  oldData: { type: String },
  unitToPixelRatio: { type: Number },
  store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
  'case': { type: mongoose.Schema.Types.ObjectId, ref: 'Case' },
  snapshot: { type: String },
  locked: { type: Boolean },
  template: { type: mongoose.Schema.Types.ObjectId, ref: 'Revision' },
  fileID: { type: String },
  isCustom: { type: Boolean },
  suggestCaseMode: { type: Boolean, default: false },
  oldCustomData: { type: String },
  unit: { type: String, default: 'in' },
  customSize: {
    type: customSizeSchema,
    default: null
  },
  adminExportPdfData: { type: Array },
  publicDesign:  {
    type: publicDesignSchema,
    default: () => ({ /* triggers default object population via the sub-schema definition */ })
  }
},{
  minimize: false,
  timestamps: true,
  usePushEach: true, // mongodb 3.6 + deprecation
  toObject: { virtuals: true, versionKey: true },
  toJSON: { virtuals: true, versionKey: false }
});

revisionSchema.plugin(mongoosePaginate);

revisionSchema.pre('save', function(next) {
  var doc = this;
  doc.updatedAt = new Date();
  if(doc.isNew){
    counter.findByIdAndUpdate({_id: 'revisionId'}, {$inc: { seq: 1} }, function(error, counter)   {
      if(error){
        return next(error);
      }
      doc.fileID = counter.seq;
      next();
    });
  } else {
    next();
  }
});

revisionSchema.virtual('design', {
  ref: 'Design', // The model to use
  localField: '_id', // Your local field, like a `FOREIGN KEY` in RDS
  foreignField: 'revisions', // Your foreign field which `localField` linked to. Like `REFERENCES` in RDS
  // If `justOne` is true, 'members' will be a single doc as opposed to
  // an array. `justOne` is false by default.
  justOne: true
});

//TODO: create virtual for Agenda

revisionSchema.index({ name: 'text' });

var model = mongoose.model('Revision', revisionSchema);

// mongoose has a few bugs with the Schema.index api in 4.6.x
// using the mongodb native api
//
// maintain an index in the background - don't block mongo requests on index generation/update
model.collection.ensureIndex({ name: 1 }, { background: true });
model.collection.ensureIndex({ fileID: 1}, { unique: true, background: true });
model.collection.ensureIndex({ locked: 1 }, { background: true });
model.collection.ensureIndex({ store: 1 }, { background: true });
model.collection.ensureIndex({ case: 1 }, { background: true });
model.collection.ensureIndex({ template: 1 }, { background: true });

//model.collection.ensureIndex({ createdAt: 1}, { background: true });
//model.collection.ensureIndex({ updatedAt: 1}, { background: true });

//model.collection.ensureIndex({ name: 1, createdAt: -1}, { background: true });
//model.collection.ensureIndex({ fileID: 1, createdAt: -1}, { background: true });
//model.collection.ensureIndex({ locked: 1, createdAt: -1}, { background: true });

//model.collection.ensureIndex({ name: 1, fileID: 1, createdAt: -1}, { background: true });
//model.collection.ensureIndex({ name: 1, fileID: 1, locked: 1, createdAt: -1}, { background: true });

model.collection.ensureIndex({ createdAt: -1, locked: 1, fileID: 1, name: 1}, { background: true });
model.collection.ensureIndex({ createdAt: -1, locked: 1, name: 1, fileID: 1}, { background: true });
model.collection.ensureIndex({ createdAt: -1, fileID: 1, name: 1, locked: 1}, { background: true });
model.collection.ensureIndex({ createdAt: -1, fileID: 1, locked: 1, name: 1}, { background: true });
model.collection.ensureIndex({ createdAt: -1, name: 1, fileID: 1, locked: 1}, { background: true });
model.collection.ensureIndex({ createdAt: -1, name: 1, locked: 1, fileID: 1}, { background: true });

module.exports = model;

// create that initial counter
counter.findOne({
  _id: 'revisionId'
}, function(err, count){
  if(!count) {
    var c = new counter();
    c._id = 'revisionId';
    c.seq = 100000;
    c.save(function(){});
  }
});
