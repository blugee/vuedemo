var bcrypt = require('bcrypt-nodejs');
var crypto = require('crypto');
var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate');
var aggregatePaginate = require('mongoose-aggregate-paginate-v2');

var userRoles = require('./../lib/globals').userRoles;

var Store = require('./Store');

var appSettingsSchema = new mongoose.Schema({
  showGrid: {type: Boolean, default: true},
  snapToGrid: {type: Boolean, default: false},
  showDepthLabels: {type: Boolean, default: true},
  autoSnapShapes: {type: Boolean, default: true},
  units: {type: String, default: "inches"},
  gridStep: {type: Number, default: null},
  nudgeSpacing: {type: Number, default: null},
  defaultOptions: {type: Array, default: []},
  language: {type: String, default: ""}
}, {
  _id: false,
  minimize: false
});

var userSchema = new mongoose.Schema({
  email: { type: String, lowercase: true }, // unique: true
  username: { type: String, lowercase: true }, // unique: true
  password: String,
  old_password: String,
  anon: { type: Boolean, default: false },
  facebook: String,
  twitter: String,
  google: String,
  tokens: Array,
  role: {
    // User
    // Admin
    // Affiliate
    // Rep
    // Librarian
    // Exporter
    // TODO: can we validate this string against the global "userRoles" object?
    name: { type: String, default: 'user' }
  },
  profile: {
    name: { type: String, default: '' },
    gender: { type: String, default: '' },
    location: { type: String, default: '' },
    website: { type: String, default: '' },
    picture: { type: String, default: '' }
  },
  store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  cartItems: Array,
  appSettings: {
    type: appSettingsSchema,
    default: () => ({ /* triggers default value population on the sub-schema */ })
  }
},
{
  minimize: false,
  timestamps: true,
  usePushEach: true, // mongodb 3.6 + deprecation
  toObject: { virtuals: true, versionKey: true },
  toJSON: { virtuals: true, versionKey: false }
});

userSchema.plugin(mongoosePaginate);
userSchema.plugin(aggregatePaginate);

/**
 * Password hash middleware.
 */
userSchema.pre('save', function(next) {
  var user = this;
  user.updatedAt = new Date();
  if (!user.isModified('password')) {
    return next();
  }
  bcrypt.genSalt(10, function(err, salt) {
    if (err) {
      return next(err);
    }
    bcrypt.hash(user.password, salt, null, function(err, hash) {
      if (err) {
        return next(err);
      }
      user.password = hash;
      next();
    });
  });
});

userSchema.virtual('needsNewPassword').get(function() {
  return typeof this.password === 'undefined';
});

/**
 * Helper method for validating user's password.
 */
userSchema.methods.comparePassword = function(candidatePassword, cb) {
  // they have the old MCB password and new one is not set yet
  if(typeof this.password === 'undefined') {
    return cb(null, (crypto.createHash('md5').update(candidatePassword).digest("hex") === this.old_password));
  }

  bcrypt.compare(candidatePassword, this.password, function(err, isMatch) {
    if (err) {
      return cb(err);
    }
    cb(null, isMatch);
  });
};

/**
 * Helper methods for getting user role
 */
userSchema.methods.isAdmin = function() {
  if (this.role.name === userRoles.admin) {
    return true;
  }
  return false;
};
userSchema.methods.isAffiliate = function() {
  if (this.role.name === userRoles.affiliate) {
    return true;
  }
  return false;
};
userSchema.methods.isRep = function() {
  if (this.role.name === userRoles.rep) {
    return true;
  }
  return false;
};
userSchema.methods.isLibrarian = function() {
  if (this.role.name === userRoles.librarian) {
    return true;
  }
  return false;
};
userSchema.methods.isExporter = function() {
  if (this.role.name === userRoles.exporter) {
    return true;
  }
  return false;
};
userSchema.methods.isUser = function() {
  if (this.role.name === userRoles.user) {
    return true;
  }
  return false;
};
userSchema.methods.currentStore = function() {
  if (this.store !== null) {
    return this.store;
  }
  return false;
};
userSchema.methods.getStoreQuery = function(ezID) {
  var storeQuery;
  if (!ezID) {
    storeQuery = {
      _id: this.store.toString()
    };
  } else {
    storeQuery = {
      ezID: ezID
    };
  }
  return storeQuery;
};
userSchema.methods.getStore = function(ezID, callback) {
  var _this = this;
  var Store = mongoose.model('Store');
  // get a query for the user's store only
  var query = _this.getStoreQuery();
  // get the users store
  Store.findOne(query).exec(function(err, myStore) {
    var store = myStore; // default to the user's store
    if (err) return callback(err);
    query = _this.getStoreQuery(ezID);
    Store.findOne(query).exec(function(err, requestStore){
      if (err) return callback(err);
      if (requestStore) {
        store = requestStore;
        // if the requested store is in the same region
        if (myStore.csCartServerInstance.toLowerCase() === requestStore.csCartServerInstance.toLowerCase()) {
          if (!requestStore.isRegionalAffiliate) {
            // i.e. 149, 200, 205, etc...
            store = myStore;
          }
        }
      }
      callback(err, store);
    });
  });
};

/**
 * Helper method for getting user's gravatar.
 */
userSchema.methods.gravatar = function(size) {
  if (!size) {
    size = 200;
  }
  if (!this.email) {
    return 'https://gravatar.com/avatar/?s=' + size + '&d=retro';
  }
  var md5 = crypto.createHash('md5').update(this.email).digest('hex');
  return 'https://gravatar.com/avatar/' + md5 + '?s=' + size + '&d=retro';
};

userSchema.methods.toJSON = function() {
  var obj = this.toObject();
  delete obj.password;
  delete obj.tokens;
  return obj;
}

userSchema.virtual('gravatarURL').get(function() {
  var size = 200;
  if (!this.email) {
    return 'https://gravatar.com/avatar/?s=' + size + '&d=retro';
  }
  var md5 = crypto.createHash('md5').update(this.email).digest('hex');
  return 'https://gravatar.com/avatar/' + md5 + '?s=' + size + '&d=retro';
});

var model = mongoose.model('User', userSchema);

// mongoose has a few bugs with the Schema.index api in 4.6.x
// using the mongodb native api
//
// maintain an index in the background - don't block mongo requests on index generation/update
model.collection.ensureIndex({ email: 1}, { unique: true, background: true,  });
model.collection.ensureIndex({ username: 1}, { background: true }); // unfortuantely this cant be unique due to 8318 nulls in the field

module.exports = model;
