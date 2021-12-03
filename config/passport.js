var _ = require('lodash');
var passport = require('passport');
var request = require('request');
var InstagramStrategy = require('passport-instagram').Strategy;
var LocalStrategy = require('passport-local').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;
var TwitterStrategy = require('passport-twitter').Strategy;
var GitHubStrategy = require('passport-github').Strategy;
var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
var LinkedInStrategy = require('passport-linkedin-oauth2').Strategy;
var OpenIDStrategy = require('passport-openid').Strategy;
var OAuthStrategy = require('passport-oauth').OAuthStrategy;
var OAuth2Strategy = require('passport-oauth').OAuth2Strategy;

var User = require('../models/User');
var Cart = require("../models/Cart");

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

/**
 * Sign in using Email and Password.
 */
passport.use(new LocalStrategy({ usernameField: 'email' }, function(email, password, done) {
  email = email.toLowerCase();
  User.findOne({ email: email }, function(err, user) {
    if (!user) {
      return done(null, false, { message: 'Email ' + email + ' not found'});
    }
    user.comparePassword(password, function(err, isMatch) {
      if (isMatch) {
        return done(null, user);
      } else {
        return done(null, false, { message: 'Invalid email or password.' });
      }
    });
  });
}));

/**
 * OAuth Strategy Overview
 *
 * - User is already logged in.
 *   - Check if there is an existing account with a provider id.
 *     - If there is, return an error message. (Account merging not supported)
 *     - Else link new OAuth account with currently logged-in user.
 * - User is not logged in.
 *   - Check if it's a returning user.
 *     - If returning user, sign in and we are done.
 *     - Else check if there is an existing account with user's email.
 *       - If there is, return an error message.
 *       - Else create a new account.
 */

/**
 * Sign in with Facebook.
 */
passport.use(new FacebookStrategy({
  // clientID: process.env.FACEBOOK_ID,
  // clientSecret: process.env.FACEBOOK_SECRET,
  clientID: '193464987679033',
  clientSecret: '6dd3e0955c04000c3f97fd7c0dcbf955',
  callbackURL: '/auth/facebook/callback',
  profileFields: ['name', 'email', 'link', 'locale', 'timezone'],
  passReqToCallback: true
}, function(req, accessToken, refreshToken, profile, done) {
  if (req.user) {
    User.findOne({ facebook: profile.id }, function(err, existingUser) {
      if (existingUser) {
        req.flash('errors', { msg: 'There is already a Facebook account that belongs to you. Sign in with that account or delete it, then link it with your current account.' });
        done(err);
      } else {
        User.findById(req.user.id, function(err, user) {
          user.facebook = profile.id;
          user.tokens.push({ kind: 'facebook', accessToken: accessToken });
          user.profile.name = user.profile.name || profile.displayName;
          user.profile.gender = user.profile.gender || profile._json.gender;
          user.profile.picture = user.profile.picture || 'https://graph.facebook.com/' + profile.id + '/picture?type=large';
          user.save(function(err) {
            req.flash('info', { msg: 'Facebook account has been linked.' });
            done(err, user);
          });
        });
      }
    });
  } else {
    User.findOne({ facebook: profile.id }, function(err, existingUser) {
      if (existingUser) {
        return done(null, existingUser);
      }
      User.findOne({ email: profile._json.email }, function(err, existingEmailUser) {
        if (existingEmailUser) {
          req.flash('errors', { msg: 'There is already an account using this email address. Sign in to that account and link it with Facebook manually from Account Settings.' });
          done(err);
        } else {
          var user = new User();
          user.email = profile._json.email;
          user.facebook = profile.id;
          user.tokens.push({ kind: 'facebook', accessToken: accessToken });
          user.profile.name = profile.displayName;
          user.profile.gender = profile._json.gender;
          user.profile.picture = 'https://graph.facebook.com/' + profile.id + '/picture?type=large';
          user.profile.location = (profile._json.location) ? profile._json.location.name : '';
          user.save(function(err) {
            done(err, user);
          });
        }
      });
    });
  }
}));

// Sign in with Twitter.

passport.use(new TwitterStrategy({
  // consumerKey: process.env.TWITTER_KEY,
  // consumerSecret: process.env.TWITTER_SECRET,
  consumerKey: 'QBJzHM6eg3ZPIj0AJSUFnfHw4',
  consumerSecret: 'uBRFUEq4TMjkQoStCz5DZWHkaF7UyRIZxnrA3hfnDuY6TLdXz4',
  callbackURL: '/auth/twitter/callback',
  passReqToCallback: true
}, function(req, accessToken, tokenSecret, profile, done) {
  if (req.user) {
    User.findOne({ twitter: profile.id }, function(err, existingUser) {
      if (existingUser) {
        req.flash('errors', { msg: 'There is already a Twitter account that belongs to you. Sign in with that account or delete it, then link it with your current account.' });
        done(err);
      } else {
        User.findById(req.user.id, function(err, user) {
          user.twitter = profile.id;
          user.tokens.push({ kind: 'twitter', accessToken: accessToken, tokenSecret: tokenSecret });
          user.profile.name = user.profile.name || profile.displayName;
          user.profile.location = user.profile.location || profile._json.location;
          user.profile.picture = user.profile.picture || profile._json.profile_image_url_https;
          user.save(function(err) {
            req.flash('info', { msg: 'Twitter account has been linked.' });
            done(err, user);
          });
        });
      }
    });

  } else {
    User.findOne({ twitter: profile.id }, function(err, existingUser) {
      if (existingUser) {
        return done(null, existingUser);
      }
      var user = new User();
      // Twitter will not provide an email address.  Period.
      // But a person’s twitter username is guaranteed to be unique
      // so we can "fake" a twitter email address as follows:
      user.email = profile.username + "@twitter.com";
      user.twitter = profile.id;
      user.tokens.push({ kind: 'twitter', accessToken: accessToken, tokenSecret: tokenSecret });
      user.profile.name = profile.displayName;
      user.profile.location = profile._json.location;
      user.profile.picture = profile._json.profile_image_url_https;
      user.save(function(err) {
        done(err, user);
      });
    });
  }
}));

/**
 * Sign in with Google.
 */
passport.use(new GoogleStrategy({
  // clientID: process.env.GOOGLE_ID,
  // clientSecret: process.env.GOOGLE_SECRET,
  clientID: '398429542960-f58t3iqefkq3b1uhsqqeq5hfkcscp5uo.apps.googleusercontent.com',
  clientSecret: 'AbXetko71qWIlPjuO0gFPMiA',
  callbackURL: '/auth/google/callback',
  passReqToCallback: true
}, function(req, accessToken, refreshToken, profile, done) {
  if (req.user) {
    User.findOne({ google: profile.id }, function(err, existingUser) {
      if (existingUser) {
        req.flash('errors', { msg: 'There is already a Google account that belongs to you. Sign in with that account or delete it, then link it with your current account.' });
        done(err);
      } else {
        User.findById(req.user.id, function(err, user) {
          user.google = profile.id;
          user.tokens.push({ kind: 'google', accessToken: accessToken });
          user.profile.name = user.profile.name || profile.displayName;
          user.profile.gender = user.profile.gender || profile._json.gender;
          user.profile.picture = user.profile.picture || profile._json.image.url;
          user.save(function(err) {
            req.flash('info', { msg: 'Google account has been linked.' });
            done(err, user);
          });
        });
      }
    });
  } else {
    User.findOne({ google: profile.id }, function(err, existingUser) {
      if (existingUser) {
        return done(null, existingUser);
      }
      User.findOne({ email: profile.emails[0].value }, function(err, existingEmailUser) {
        if (existingEmailUser) {
          req.flash('errors', { msg: 'There is already an account using this email address. Sign in to that account and link it with Google manually from Account Settings.' });
          done(err);
        } else {
          var user = new User();
          user.email = profile.emails[0].value;
          user.google = profile.id;
          user.tokens.push({ kind: 'google', accessToken: accessToken });
          user.profile.name = profile.displayName;
          user.profile.gender = profile._json.gender;
          user.profile.picture = profile._json.image.url;
          user.save(function(err) {
            done(err, user);
          });
        }
      });
    });
  }
}));

/**
 * Login Required middleware.
 */
exports.isAuthenticated = function(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  if (req.xhr) {
    res.status(403).json({error:'not logged in'});
  } else {
    res.redirect('/login');
  }

};

/*
  Helper methods to approve the lowest privilege necessary for a route.
*/
var userRoles = require('./../lib/globals').userRoles;
exports.isAtLeastAdmin = function(req, res, next) {
  if (req.user.role.name === userRoles.admin) {
    return next();
  }
  res.redirect('/login')
};
exports.isAtLeastAffiliate = function(req, res, next) {
  if (req.user.role.name === userRoles.affiliate ||
      req.user.role.name === userRoles.admin) {
    return next();
  }
  res.redirect('/login')
};
exports.isAtLeastRep = function(req, res, next) {
  if (req.user.role.name === userRoles.rep ||
      req.user.role.name === userRoles.affiliate ||
      req.user.role.name === userRoles.admin) {
    return next();
  }
  res.redirect('/login')
};
exports.isAtLeastExporter = function(req, res, next) {
  if (req.user.role.name === userRoles.exporter ||
      req.user.role.name === userRoles.rep ||
      req.user.role.name === userRoles.affiliate ||
      req.user.role.name === userRoles.admin) {
    return next();
  }
  res.redirect('/login')
};

exports.isAtLeastExporterReturn403 = function(req, res, next) {
  if (req.user.role.name === userRoles.exporter ||
    req.user.role.name === userRoles.rep ||
    req.user.role.name === userRoles.affiliate ||
    req.user.role.name === userRoles.admin) {
    req.user.isAtleastExporter = true;
  }
  if (req.xhr) {
    res.status(403);
    // subsequent request handlers can check the value of req.user.isAtleastExporter
    return next();
  } else {
    res.redirect('/login')
  }
};

exports.isAtLeastLibrarian = function(req, res, next) {
  if (req.user.role.name === userRoles.librarian ||
    req.user.role.name === userRoles.admin) {
    return next();
  }
  res.redirect('/login')
};

/**
 * Authorization Required middleware.
 */
exports.isAuthorized = function(req, res, next) {
  var provider = req.path.split('/').slice(-1)[0];

  if (_.find(req.user.tokens, { kind: provider })) {
    next();
  } else {
    res.redirect('/auth/' + provider);
  }
};

/**
 * X-Auth-Token Required middleware.
 */
exports.requireXAuthToken = function(req, res, next) {
  let token, region;

  if (req.headers['x-auth-token']) {
    token = req.headers['x-auth-token'];
  } else {
    res.status(401);
    next(new Error("Missing required X-Auth-Token header!"));
    return;
  }

  if (req.headers['x-auth-region']) {
    region = req.headers['x-auth-region'];
  } else {
    res.status(401);
    next(new Error("Missing required X-Auth-Region header!"));
    return;
  }

  Cart.findOne({region: region}, function (err, cart) {
    if (err) {
      next(err);
    } else {
      if (!cart || cart.xAuthToken !== token) {
        res.status(403);
        next(new Error("Invalid token! Not authorized to access this resource."));
        return;
      }
      req.cart = cart;
      next();
    }
  });
};
