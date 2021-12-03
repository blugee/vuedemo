var _ = require('lodash');
var async = require('async');
var crypto = require('crypto');
var nodemailer = require('nodemailer');
var passport = require('passport');
var sparkPostTransport = require('nodemailer-sparkpost-transport');
var request = require('request');

var User = require('../models/User');
var Store = require('../models/Store');
var Design = require('../models/Design');
var Cart = require("../models/Cart");

/**
 * GET /login
 * Login page.
 */
exports.getLogin = function (req, res) {
  if (req.user) {
    return res.redirect('/');
  }
  res.render('account/login', {
    title: 'Login'
  });
};

/**
 * POST /login
 * Sign in using email and password.
 */
exports.postLogin = function (req, res, next) {
  req.assert('email', 'enter_valid_email').isEmail();
  req.assert('password', 'Password cannot be blank').notEmpty();

  var errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/login');
  }

  passport.authenticate('local', function (err, user, info) {

    function done() {
      Store.findOne({ _id: user.store }, function (err, foundStore) {
        res.redirect('/app?store=' + foundStore.ezID + '&case=pz4');
      });
    }

    if (err) {
      return next(err);
    }
    if (!user) {
      req.flash('errors', { msg: info.message });
      return res.redirect('/login');
    }
    req.logIn(user, function (err) {
      if (err) {
        return next(err);
      }
      if (!user.store) {
        var storeParam = '149';
        if (req.query.store) {
          storeParam = req.query.store;
        }
        Store.findOne({ ezID: storeParam }, function (err, foundStore) {
          user.store = foundStore
          user.save(function (err, user) {
            done();
          })
        });
      } else {
        done();
      }
    });
  })(req, res, next);
};

exports.postLoginJSON = function (req, res, next) {
  passport.authenticate('local', function (error, user, info) {
    if (error) {
      return res.status(500).json(error);
    }
    if (!user) {
      return res.status(401).json(info.message);
    }
    req.logIn(user, function (err) {
      if (err) {
        return res.status(500).json(err);
      }
      var
        isAdmin = user.isAdmin(),
        isAffiliate = user.isAffiliate(),
        isRep = user.isRep(),
        isLibrarian = user.isLibrarian(),
        isUser = user.isUser();

      user.getStore(req.body.store, function (err, store) {
        if (err) {
          return res.status(500).json(err);
        }

        user = user.toObject();
        user._store = store;
        user.store = store._id;

        delete user.password;
        delete user.tokens;
        user.isAdmin = isAdmin;
        user.isAffiliate = isAffiliate;
        user.isRep = isRep;
        user.isLibrarian = isLibrarian;
        user.isUser = isUser;
        res.json(user);
      });
    });

  })(req, res, next);
};

exports.postRegisterJSON = function (req, res, next) {
  req.assert('email', 'enter_valid_email').isEmail();
  req.assert('password', 'password_must_be_4_long').len(4);

  var errors = req.validationErrors();
  if (errors) {
    return res.status(406).json({ msg_key: errors[0].msg });
  }
  var storeParam = req.body.store ? req.body.store : '149';

  var user = new User({
    email: req.body.email,
    password: req.body.password,
    role: {
      name: 'user'
    }
  });

  User.findOne({ email: { $regex: new RegExp('^' + req.body.email.toLowerCase(), 'i') } }, function (err, existingUser) {
    if (existingUser) {
      return res.status(406).json({ msg_key: 'account_exists' });
    }
    Store.findOne({ ezID: storeParam }, function (err, foundStore) {
      if (!err) {
        user.store = foundStore._id;
      }
      user.save(function (err) {
        if (err) {
          return res.status(500).json(err);
        }
        req.logIn(user, function (err) {
          if (err) {
            return res.status(500).json(err);
          }
          user = user.toObject();
          delete user.password;
          delete user.tokens;
          user.isAdmin = false;
          user.isAffiliate = false;
          user.isRep = false;
          user.isLibrarian = false;
          res.json(user);
        });
      });
    })
  });
};

/**
 * GET /logout
 * Log out.
 */
exports.postLogoutJSON = function (req, res) {
  req.logout();
  res.json({ status: 'OK' })
};

/**
 * GET /logout
 * Log out.
 */
exports.logout = function (req, res) {
  req.logout();
  res.redirect('/');
};

/**
 * GET /signup
 * Signup page.
 */
exports.getSignup = function (req, res) {
  if (req.user) {
    return res.redirect('/');
  }
  res.render('account/signup', {
    title: 'Create Account'
  });
};

/**
 * GET /edit user
 * Edit a current user's role
**/
exports.getEdit = function (req, res, next) {
  User.findOne({
    email: {
      $regex: new RegExp('^' + req.params.email.toLowerCase(), 'i')
    }
  }, function (err, foundUser) {
    if (!foundUser) {
      res.render('404', { url: req.url });
      return;
    }

    Store.find()
      .select({ name: 1, ezID: 1 })
      .sort('name')
      .lean()
      .exec(function (storeErr, stores) {
        if (storeErr) {
          res.render('500');
          return;
        } else if (stores) {
          if (foundUser.store) {
            stores = stores.map(function (s) {
              if (s._id.equals(foundUser.store)) {
                s.selected = true;
              }
              return s;
            });
          } else {
            stores = stores.map(function (s) {
              if (s.ezID === '149') {
                s.selected = true;
              }
              return s;

            });
          }

        }
        res.render('users/edit', {
          foundUser: foundUser,
          stores: stores,
        });
      });
  });
};

/**
 * POST /edit user
 * Edit a current user's role
**/
exports.postEdit = function (req, res, next) {
  var user = User.findOne({
    email: {
      $regex: new RegExp('^' + req.params.email.toLowerCase(), 'i')
    }
  }, function (err, foundUser) {
    if (!foundUser) {
      res.render('404', { url: req.url });
      return;
    }
    foundUser.role.name = req.body.role;
    foundUser.store = req.body.store;
    foundUser.save(function (err) {
      if (err) {
        req.flash('errors', [{ msg: 'Unable to update user.' }]);
      }
    });
    res.redirect('/users')
  });

};

/**
 * POST /signup
 * Create a new local account.
 */
exports.postSignup = function (req, res, next) {
  req.assert('email', 'enter_valid_email').isEmail();
  req.assert('password', 'password_must_be_4_long').len(4);
  req.assert('confirmPassword', 'Passwords do not match').equals(req.body.password);

  var errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/signup');
  }

  var storeParam = req.query.store ? req.query.store : '149';

  Store.findOne({ ezID: storeParam }, function (err, foundStore) {
    if (err) {
      req.flash('errors', { msg: 'Cannot create account at this time.' });
      return res.redirect('/signup');
    }

    var user = new User({
      email: req.body.email,
      password: req.body.password,
      role: {
        name: 'user'
      },
      store: foundStore
    });

    User.findOne({
      email: {
        $regex: new RegExp('^' + req.body.email.toLowerCase(), 'i')
      }
    }, function (err, existingUser) {
      if (existingUser) {
        req.flash('errors', { msg: 'Account with that email address already exists.' });
        return res.redirect('/signup');
      }
      user.save(function (err) {
        if (err) {
          return next(err);
        }
        req.logIn(user, function (err) {
          if (err) {
            return next(err);
          }
          res.redirect('/app?store=' + foundStore.ezID + '&case=pz4');
        });
      });
    });



  });
};

/**
 * GET /account
 * Profile page.
 */
exports.getAccount = function (req, res) {
  res.render('account/profile', {
    title: 'Account Management'
  });
};

/**
 * POST /account/profile
 * Update profile information.
 */
exports.postUpdateProfile = function (req, res, next) {
  User.findById(req.user.id, function (err, user) {
    if (err) {
      return next(err);
    }

    if ('email' in req.body) user.email = req.body.email;
    if ('name' in req.body) user.profile.name = req.body.name;
    if ('gender' in req.body) user.profile.gender = req.body.gender;
    if ('location' in req.body) user.profile.location = req.body.location;
    if ('website' in req.body) user.profile.website = req.body.website;
    if ('username' in req.body) user.username = req.body.username;

    user.email = req.body.email || user.email || '';
    user.profile.name = req.body.name || user.profile.name || '';
    user.profile.gender = req.body.gender || user.profile.gender || '';
    user.profile.location = req.body.location || user.profile.location || '';
    user.profile.website = req.body.website || user.profile.website || '';
    user.username = req.body.username || user.username || '';

    user.save(function (err) {
      if (err) {
        return next(err);
      }

      if (req.xhr) {
        res.json({
          email: user.email,
          name: user.profile.name,
          gender: user.profile.gender,
          location: user.profile.location,
          website: user.profile.website,
          username: user.username
        });
        return;
      }

      req.flash('success', { msg: 'Profile information updated.' });
      res.redirect('/account');
    });
  });
};

/**
 * POST /account/appSettings
 * Update /app settings.
 */
exports.postUpdateUserAppSettings = async (req, res, next) => {
  let user = req.user;

  if (!user.appSettings.toObject()) {
    user.appSettings = {};
  }

  user.appSettings.showGrid = typeof req.body.showGrid !== 'undefined' ? req.body.showGrid : user.appSettings.showGrid;
  user.appSettings.snapToGrid = typeof req.body.snapToGrid !== 'undefined' ? req.body.snapToGrid : user.appSettings.snapToGrid;
  user.appSettings.showDepthLabels = typeof req.body.showDepthLabels !== 'undefined' ? req.body.showDepthLabels : user.appSettings.showDepthLabels;
  user.appSettings.autoSnapShapes = typeof req.body.autoSnapShapes !== 'undefined' ? req.body.autoSnapShapes : user.appSettings.autoSnapShapes;
  user.appSettings.language = typeof req.body.language !== 'undefined' ? req.body.language : user.appSettings.language;
  user.appSettings.units = typeof req.body.units !== 'undefined' ? req.body.units : user.appSettings.units;
  user.appSettings.gridStep = typeof req.body.gridStep !== 'undefined' ? req.body.gridStep : user.appSettings.gridStep;
  user.appSettings.nudgeSpacing = typeof req.body.nudgeSpacing !== 'undefined' ? req.body.nudgeSpacing : user.appSettings.nudgeSpacing;

  user.markModified('appSettings');
  let savedUser;

  try {
    savedUser = await user.save();
  } catch (e) {
    return next(e);
  }

  // sync the session
  req.user.appSettings.showGrid = savedUser.appSettings.showGrid;
  req.user.appSettings.snapToGrid = savedUser.appSettings.snapToGrid;
  req.user.appSettings.showDepthLabels = savedUser.appSettings.showDepthLabels;
  req.user.appSettings.autoSnapShapes = savedUser.appSettings.autoSnapShapes;
  req.user.appSettings.language = savedUser.appSettings.language;
  req.user.appSettings.units = savedUser.appSettings.units;
  req.user.appSettings.gridStep = savedUser.appSettings.gridStep;
  req.user.appSettings.nudgeSpacing = savedUser.appSettings.nudgeSpacing;

  res.status(200).json({
    status: 'OK',
    data: savedUser.appSettings
  });
}


exports.postUpdateUserDefaultCheckoutOptions = async (req, res, next) => {
  let err, user = req.user;

  if (!req.body.data) {
    err = new Error('data param not present');
    next(err);
  }

  user.appSettings.defaultOptions = JSON.parse(req.body.data);
  user.markModified('appSettings.defaultOptions');

  let savedUser;

  try {
    savedUser = await user.save();
  } catch (e) {
    return next(e);
  }

  res.status(200).json({
    status: 'OK',
    data: savedUser.appSettings
  });
}

/**
 * POST /account/password
 * Update current password.
 */
exports.postUpdatePassword = function (req, res, next) {
  req.assert('password', 'Password must be at least 4 characters long').len(4);
  req.assert('confirmPassword', 'Passwords do not match').equals(req.body.password);

  var errors = req.validationErrors();

  if (errors) {
    if (req.xhr) {
      res.json({ success: false, errors: errors });
      return;
    }
    req.flash('errors', errors);
    return res.redirect('/account');
  }

  User.findById(req.user.id, function (err, user) {
    if (err) {
      return next(err);
    }
    user.password = req.body.password;
    user.save(function (err) {
      if (err) {
        return next(err);
      }

      if (req.xhr) {
        res.json({ success: true, msg: 'Password has been changed.' });
        return;
      }

      req.flash('success', { msg: 'Password has been changed.' });
      res.redirect('/account');
    });
  });
};

/**
 * POST /account/delete
 * Delete user account.
 */
exports.postDeleteAccount = function (req, res, next) {
  User.remove({ _id: req.user.id }, function (err) {
    if (err) {
      return next(err);
    }
    req.logout();
    req.flash('info', { msg: 'Your account has been deleted.' });
    res.redirect('/');
  });
};

/**
 * GET /account/unlink/:provider
 * Unlink OAuth provider.
 */
exports.getOauthUnlink = function (req, res, next) {
  var provider = req.params.provider;
  User.findById(req.user.id, function (err, user) {
    if (err) {
      return next(err);
    }
    user[provider] = undefined;
    user.tokens = _.reject(user.tokens, function (token) { return token.kind === provider; });
    user.save(function (err) {
      if (err) return next(err);
      req.flash('info', { msg: provider + ' account has been unlinked.' });
      res.redirect('/account');
    });
  });
};

/**
 * GET /reset/:token
 * Reset Password page.
 */
exports.getReset = function (req, res) {
  User
    .findOne({ resetPasswordToken: req.params.token })
    .where('resetPasswordExpires').gt(Date.now())
    .exec(function (err, user) {
      if (err) {
        return next(err);
      }
      if (!user) {
        req.flash('errors', { msg: 'Password reset token is invalid or has expired.' });
        return res.redirect('/forgot');
      }
      res.render('account/reset', {
        title: 'Password Reset'
      });
    });
};

/**
 * POST /reset/:token
 * Process the reset password request.
 */
exports.postReset = function (req, res, next) {
  req.assert('password', 'Password must be at least 4 characters long.').len(4);
  req.assert('confirm', 'Passwords must match.').equals(req.body.password);

  var errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('back');
  }

  async.waterfall([
    function (done) {
      User
        .findOne({ resetPasswordToken: req.params.token })
        .where('resetPasswordExpires').gt(Date.now())
        .exec(function (err, user) {
          if (err) {
            return next(err);
          }
          if (!user) {
            req.flash('errors', { msg: 'Password reset token is invalid or has expired.' });
            return res.redirect('back');
          }
          user.password = req.body.password;
          user.resetPasswordToken = undefined;
          user.resetPasswordExpires = undefined;
          user.save(function (err) {
            if (err) {
              return next(err);
            }
            req.logIn(user, function (err) {
              done(err, user);
            });
          });
        });
    },
    function (user, done) {
      var transporter = nodemailer.createTransport(
        sparkPostTransport({
          "options": {
            "open_tracking": true,
            "click_tracking": true,
            "transactional": true
          },
          "campaign_id": "password-changed",
          "metadata": {
            "reason": "password_changed"
          },
          "content": {
            "template_id": "password-changed"
          }
        })
      );
      transporter.sendMail({
        "recipients":
          [{
            "address": {
              "email": user.email
            }
          }
          ]
      }, function (err) {
        if (err) { }
        req.flash('success', { msg: 'Success! Your password has been changed.' });
        done(err);
      });
    }
  ], function (err) {
    if (err) {
      return next(err);
    }
    res.redirect('/');
  });
};

/**
 * GET /forgot
 * Forgot Password page.
 */
exports.getForgot = function (req, res) {
  if (req.isAuthenticated()) {
    return res.redirect('/');
  }
  res.render('account/forgot', {
    title: 'Forgot Password'
  });
};

/**
 * GET /users
 * Users index
 */
exports.index = function (req, res, next) {
  let page = req.query.page || req.cookies.page;
  var search = req.query.search || req.cookies.search;
  var user = req.user;
  var query = {};

  var opts = {
    page: Math.max(1, parseInt(page || 1)),
    limit: Math.max(10, parseInt(req.query.size || 10)),
    lean: true
  };

  if (!user.isAdmin()) {
    query.store = user.store;
  }

  if (!!search) {
    query['$or'] = [
      { 'email': RegExp('' + search, 'i') },
      { 'username': RegExp('' + search, 'i') }
    ];
  }

  User.paginate(query, opts, function (err, users) {
    if (err) return next(err);
    users.search = search || '';
    if (users.page) {
      res.cookie('page', users.page, { path: '/users' });
    }
    res.render('users/index', users);
  });
};

/**
 * GET /users/email
 * Users index
 */
exports.show = function (req, res) {
  var email = req.params.email.toLowerCase();
  var user = req.user;
  var query =
    user.isAdmin() ?
      User.findOne({
        email: {
          $regex: new RegExp('^' + email, 'i')
        }
      }) :
      User.findOne({
        store: user.store,
        email: {
          $regex: new RegExp('^' + email, 'i')
        }
      });

  query.exec(function (err, thisUser) {
    if (!thisUser) {
      res.render('404', { url: req.url });
      return;
    }

    res.render('users/show', {
      thisUser: thisUser
    });
  });
};

/**
 * POST /forgot
 * Create a random token, then the send user an email with a reset link.
 */
exports.postForgot = function (req, res, next) {
  req.assert('email', 'Please enter a valid email address.').isEmail();

  var errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/forgot');
  }

  async.waterfall([
    function (done) {
      crypto.randomBytes(16, function (err, buf) {
        var token = buf.toString('hex');
        done(err, token);
      });
    },
    function (token, done) {
      User.findOne({
        email: {
          $regex: new RegExp('^' + req.body.email.toLowerCase(), 'i')
        }
      }, function (err, user) {
        if (!user) {
          req.flash('errors', { msg: 'no_account_exists' });
          return res.redirect('/forgot');
        }
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        user.save(function (err) {
          done(err, token, user);
        });
      });
    },
    function (token, user, done) {
      var template = 'forgot-password';
      var reason = 'forgot_password';
      if (req.body.welcome) {
        template = 'welcome';
        reason = 'welcome';
      }
      var transporter = nodemailer.createTransport(sparkPostTransport({
        "options": {
          "open_tracking": true,
          "click_tracking": true,
          "transactional": true
        },
        "campaign_id": template,
        "metadata": {
          "reason": reason
        },
        "substitution_data": {
          "token": token
        },
        "content": {
          "template_id": template
        }
      }));


      transporter.sendMail({
        "recipients": [
          {
            "address": {
              "email": user.email
            }
          }
        ]
      }, function (err, info) {
        if (err) {
          done(err, 'done', user);
        } else {
          done(err, 'done', user);
        }
      });
    }
  ], function (err) {
    if (err) {
      return next(err);
    }
    req.flash('success', { msg: 'We sent password reset instructions to the email address you provided. Remember to check your spam or junk folder if you don\'t see it. ' });
    res.redirect('/forgot');
  });
};

/**
 * POST /forgot
 * Create a random token, then the send user an email with a reset link.
 */
exports.postForgotJSON = function (req, res, next) {
  //  req.assert('email', 'Please enter a valid email address.').isEmail();
  req.assert('email', 'enter_valid_email').isEmail();

  var errors = req.validationErrors();

  if (errors) {
    return res.status(406).json(errors);
  }

  async.waterfall([
    function (done) {
      crypto.randomBytes(16, function (err, buf) {
        var token = buf.toString('hex');
        done(err, token);
      });
    },
    function (token, done) {
      User.findOne({
        email: {
          $regex: new RegExp('^' + req.body.email.toLowerCase(), 'i')
        }
      }, function (err, user) {
        if (!user) {
          return res.status(406).json({ msg: 'no_account_exists' });
        }
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        user.save(function (err) {
          done(err, token, user);
        });
      });
    },
    function (token, user, done) {
      var template = 'forgot-password-' + req.body.lang;
      var reason = 'forgot_password';
      if (req.body.welcome) {
        template = 'welcome';
        reason = 'welcome';
      }
      var transporter = nodemailer.createTransport(sparkPostTransport({
        "options": {
          "open_tracking": true,
          "click_tracking": true,
          "transactional": true
        },
        "campaign_id": template,
        "metadata": {
          "reason": reason
        },
        "substitution_data": {
          "token": token
        },
        "content": {
          "template_id": template
        }
      }));


      transporter.sendMail({
        "recipients": [
          {
            "address": {
              "email": user.email
            }
          }
        ]
      }, function (err, info) {
        if (err) {
          done(err, 'done', user);
        } else {
          done(err, 'done', user);
        }
      });
    }
  ], function (err, status, user) {
    if (err) {
      return res.status(406).json(err);
    }
    return res.json({ msg: 'email_has_been_sent' });
  });
};

/**
 * POST /emailAdmin
 * send admin an email with a user and file info.
 */
exports.emailAdmin = function (req, res) {
  var email = req.user.email;
  var fileID = req.body.fileID;
  var designName = req.body.designName;
  var storeID = req.body.storeID;

  var transporter = nodemailer.createTransport(sparkPostTransport({
    "options": {
      "open_tracking": true,
      "click_tracking": true,
      "transactional": true
    },
    "campaign_id": 'admin-email',
    "substitution_data": {
      "useremail": email,
      "fileid": fileID,
      "designname": designName,
      // TODO: more fields here
    },
    "content": {
      "template_id": 'admin-email'
    }
  }));

  Store.findOne({
    ezID: storeID
  }, function (storeErr, foundStore) {
    if (storeErr) {
      // ...
    } else {
      if (foundStore.shouldEmailAdmin && foundStore.adminEmail) {
        transporter.sendMail({
          "recipients": [
            {
              "address": {
                "email": foundStore.adminEmail
              }
            }
          ]
        }, function (err, info) {
          if (err) {
            // ...
            return;
          }
        });
      }
    }
  });
};

exports.getCartItems = function (req, res) {
  if (!req.user) {
    return res.json({ cartItems: [] });
  }
  User.findOne(
    {
      email: req.user.email
    }, function (userErr, foundUser) {
      if (userErr) {
        return res.status(500);
      } else if (!foundUser) {
        return res.status(404);
      }

      return res.json({ cartItems: foundUser.cartItems });
    }
  );
};

exports.storeCartItems = function (req, res) {
  User.findOne(
    {
      email: req.user.email
    }, function (userErr, foundUser) {
      if (userErr) {
        return res.status(500);
      } else if (!foundUser) {
        return res.status(404);
      }

      var items = JSON.parse(req.body.items);
      items.forEach(function (item) {
        // fix minor display bug
        delete item.showingSelectedOptionsOnCartItem;
      });

      foundUser.cartItems = items;
      foundUser.save(function (saveErr, savedUser) {
        if (saveErr) {
          return res.status(500);
        }
        return res.json({ message: 'Success' });
      });
    }
  );
};

exports.removeCartItem = function (req, res) {
  // NOTE: this function only removes a single cartItem from the current user's cartItems array.
  // Clearing the whole cartItems array is the same as passing "[]" to storeCartItems.

  User.findOne(
    {
      email: req.user.email
    }, function (userErr, foundUser) {
      if (userErr) {
        return res.status(500);
      } else if (!foundUser) {
        return res.status(404);
      }

      // req.body.index

      if (req.body.index) {
        foundUser.cartItems.splice(req.body.index, 1);
      }
      foundUser.save(function (saveErr, savedUser) {
        if (saveErr) {
          return res.status(500);
        }
        return res.json({ message: 'Success' });
      });
    }
  );
};

// should pre-vet w/ passportConf.requireXAuthToken middleware
exports.clearCartItemsExternally = function (req, res, next) {
  if (!req.body.products || !Array.isArray(req.body.products) || !req.body.products.length) {
    res.status(400);
    next(new Error('products is missing or empty'));
    return;
  }

  let itemUuids = req.body.products.map(p => p.fileUUID);

  User.findOne({ 'cartItems.fileUuid': { '$in': itemUuids } },
    function (err, foundUser) {
      if (err) {
        res.status(500);
        rollbar.error(err, req, { level: "warning" });
        return next(new error("Server error while querying users"));
      } else if (!foundUser) {
        res.status(404);
        return next(new Error("Not found"));
      }

      // Before removing an item from the user's cart, we need to find its Design document and un-set the
      // softLocked boolean value so that they can resume editing the design in the future.
      if (foundUser.cartItems && foundUser.cartItems.length > 0) {
        let cartItems = foundUser.cartItems.map(i => i);
        Promise.all(
          cartItems.map((cartItem, index) => {
            // filter only items present in the request
            if (itemUuids.indexOf(cartItem.fileUuid) > -1) {
              // remove the item from the cart
              foundUser.cartItems = foundUser.cartItems.filter(i => i.fileUuid !== cartItem.fileUuid);
              // queue softLocked promise
              return Design.findOneAndUpdate({ _id: cartItem.designId }, { softLocked: false });
            } else {
              return false;
            }
          }).filter(p => !!p)
        )
          .then(() => {
            // save the cart
            foundUser.save(function (err, savedUser) {
              if (err) {
                res.status(500);
                rollbar.error(err, req, { level: "warning" });
                return next(new Error("Server error while clearing the cart"));
              }
              res.status(200).json({ message: "Success" });
            });
          })
          .catch(err => {
            rollbar.error(err, req, { level: "warning" });
          });
      } else {
        res.status(200).json({ message: "No cartItems found for this user" });
      }
    }
  );
};




exports.getCartItemSnapshotsAndLayers = function (req, res) {
  // Query for the designIds of this user's cart.
  // Then, return the snapshot strings along with their associated designIds.

  User.findOne(
    {
      email: req.user.email
    }, function (userErr, foundUser) {
      if (userErr) {
        return res.status(500);
      } else if (!foundUser) {
        return res.status(404);
      }

      var designIds = foundUser.cartItems.map(function (item) {
        return item.designId;
      });

      Design.find(
        {
          _id: { $in: designIds }
        })
        .populate('currentRev')
        .exec(
          function (findErr, foundDesigns) {
            if (findErr) {
              return res.status(500)
            } else {

              // Note: there's a nicer ES6 way to do this
              var output = {};
              foundDesigns.forEach(function (design) {
                output[design._id] = {
                  snapshot: design.currentRev.snapshot,
                  layers: design.currentRev.layers
                };
              });

              return res.json(output);
            }
          });
    }
  );
};

exports.getCartOrderHistory = function (req, res) {
  if (!req.user || !req.user.email) {
    return res.status(401).json({ msg: 'You need to be signed in for this operation.' });
  }

  var doneSettingStoreKey = function (cart) {
    var url = new URL(cart.baseURL);
    url.username = cart.apiUser;
    url.password = cart.apiKey;
    url.pathname = '/api/orders/';
    url.search = '?items_per_page=100';

    console.log(req.user.role.name)
    if (req.user.role.name !== "admin")
      url.search = url.search + '&email=' + req.user.email;
    let orderData = []
    request({
      // staging/development only permit un-signed/self-signed cert
      rejectUnauthorized: (process.env.NODE_ENV === 'production'),
      method: 'GET',
      url: url.toString()
    }, function (e, r, body) {
      if (e) {
        return res.status(500).json({ msg: 'Unexpected error when getting your order history.' });
      } else {
        var orders = JSON.parse(body).orders;
        orderData = orders
        var orderIds = !orders ? [] : orders.map(function (order) {
          return order.order_id;
        });

        var callObj = {};
        orderIds.forEach(function (id) {
          callObj[id] = function (asyncCallback) {
            var url = new URL(cart.baseURL);
            url.username = cart.apiUser;
            url.password = cart.apiKey;
            url.pathname = '/api/orders/' + id;

            request({
              // staging/development only permit un-signed/self-signed cert
              rejectUnauthorized: (process.env.NODE_ENV === 'production'),
              method: 'GET',
              url: url.toString()
            }, function (a_e, a_r, a_body) {
              if (a_e) {
                console.log('Error when getting store products asynchronously: ', a_e);
                asyncCallback(a_e, null);
              } else {
                asyncCallback(null, JSON.parse(a_body));
              }
            });
          };
        });

        async.parallel(callObj, function (asyncErr, asyncResults) {
          if (asyncErr) {
            console.log('asyncErr: ', asyncErr);
            return res.status(500);
          } else {
            var orderedProducts = [];
            Object.keys(asyncResults).forEach(function (resultKey) {
              if (asyncResults.hasOwnProperty(resultKey)) {
                if (asyncResults[resultKey].products) {
                  Object.keys(asyncResults[resultKey].products).forEach(function (productKey) {
                    if (asyncResults[resultKey].products.hasOwnProperty(productKey)) {
                      // let matchingIndex = -1
                      // if (orderData && orderData.length > 0) {
                      //   matchingIndex = orderData.findIndex(item => item.order_id === asyncResults[resultKey].products[productKey].order_id)
                      // }
                      // if (matchingIndex >= 0) {
                      //   orderedProducts.push({ ...asyncResults[resultKey].products[productKey], carrier: orderData[matchingIndex].carrier, tracking_number: orderData[matchingIndex].tracking_number, });
                      // } else {
                      orderedProducts.push(asyncResults[resultKey].products[productKey]);
                      // }

                    }
                  });
                }
              }
            });

            return res.json(orderedProducts);
          }
        });
      }
    });
  };

  // get the user's store, and default to USA if none
  var storeId = null;
  if (req.params.storeId && req.params.storeId !== 'undefined') {
    storeId = req.params.storeId;
  } else if (req.user && req.user.store) {
    storeId = req.user.store;
  }

  Cart.findOne({ region: 'USA' }, function (err, cart) {
    if (storeId) {
      Store
        .findOne({
          _id: storeId
        })
        .populate('csCartServer')
        .exec(function (err, store) {
          if (err || !store) {
            doneSettingStoreKey(cart);
          } else {
            cart = store.csCartServer || cart;
            doneSettingStoreKey(cart);
          }
        });
    } else {
      doneSettingStoreKey(cart);
    }
  });
};


exports.getCartOrderHistoryPagination = function (req, res) {
  if (!req.user || !req.user.email) {
    return res.status(401).json({ msg: 'You need to be signed in for this operation.' });
  }

  // These defaults may get overridden below.
  var userStoreKey = 'USA';
  var userStoreCartID = 1;

  var doneSettingStoreKey = function () {

    Cart.find()
      .populate('stores')
      .exec(function (err, carts) {
        if (err) console.warn(err);

        var csCartServers = {};
        carts.forEach(function (cart) {
          csCartServers[cart.region] = cart;
        });

        var cart = csCartServers[userStoreKey];
        console.log("user.js");
        var url = new URL(cart.baseURL);
        url.username = cart.apiUser;
        url.password = cart.apiKey;
        url.pathname = '/api/MyOrders/';
        let searchString = ''
        if (req.params.search !== 'undefined') {
          searchString = `&searchString=${req.params.search}`
        }
        url.search = `?items_per_page=${req.params.limit}&page=${req.params.page}${searchString}`;

        console.log(req.user.role.name)
        if (req.user.role.name !== "admin")
          url.search = url.search + '&email=' + req.user.email;
        let orderData = []
        request({
          // staging/development only permit un-signed/self-signed cert
          rejectUnauthorized: (process.env.NODE_ENV === 'production'),
          method: 'GET',
          url: url.toString()
        }, function (e, r, body) {
          if (e) {
            return res.status(500).json({ msg: 'Unexpected error when getting your order history.' });
          } else {
            var orders = JSON.parse(body)
            return res.json(orders);
          }
        });
      });
  };


  var storeId = null;
  if (req.params.storeId && req.params.storeId !== 'undefined') {
    storeId = req.params.storeId;
  } else if (req.user && req.user.store) {
    storeId = req.user.store;
  }

  if (storeId) {
    Store
      .findOne({
        _id: storeId
      })
      .select({
        csCartID: 1,
        csCartServerInstance: 1
      })
      .lean()
      .exec(function (err, foundStore) {
        if (err || !foundStore) {
          doneSettingStoreKey();
        } else {
          userStoreKey = foundStore.csCartServerInstance || 'USA';
          userStoreCartID = foundStore.csCartID || 1;
          doneSettingStoreKey();
        }
      });
  } else {
    doneSettingStoreKey();
  }
};

