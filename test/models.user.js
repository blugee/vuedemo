"use strict";

var mongoose = require('mongoose');
mongoose.Promise = global.Promise;

var chai = require('chai');
var expect = require('chai').expect;
var should = require('chai').should();

var User = require('../models/User');

var path = require('path');
var dotenv = require('dotenv');
const {FieldValueInstance} = require('twilio/lib/rest/preview/understand/assistant/fieldType/fieldValue');
dotenv.config({ path:  path.resolve(__dirname, '../', '.env')});

describe('User Model', function() {
  var user;

  before(function(done) {
    /**
    * Connect to MongoDB.
    */
    mongoose.connect(process.env.MONGODB || process.env.MONGOLAB_URI, {useMongoClient: true}, done);
    mongoose.connection.on('error', function(err) {
      done(err);
    });
  });

  after(function(done) {
    mongoose.disconnect(done);
  });

  it('can create a new user', function(done) {
    user = new User({
      "username" : "test_user",
      "old_password" : "f3ee0e4db3bc970b6636ed2d66c0e068",
      "email" : "test_user@domain.com",
      "store" : "58772e3d6a5ca324a20164e4",
      "role" : {
          "name" : "user"
      },
      "password" : "000_passw0rd_000",
    });

    user.save(function(err, user) {
      if (err) return done(err);

      expect(user.toObject())
        .to.be.an('object')
        .that.has.keys([
          'id',
          '_id',
          "__v",
          'anon',
          'role',
          'email',
          'username',
          'password',
          'old_password',
          'needsNewPassword',
          'profile',
          'store',
          'tokens',
          'gravatarURL',
          'appSettings',
          'cartItems',
          'createdAt',
          'updatedAt'
        ]);

      expect(user.appSettings.toObject())
        .to.be.an('object')
        .that.has.keys([
          "gridStep",
          "language",
          "units",
          "nudgeSpacing",
          "autoSnapShapes",
          "defaultOptions",
          "showDepthLabels",
          "snapToGrid",
          "showGrid"
        ]);

      done();
    });
  });

  it('can get a user', function(done) {
    User
      .findOne({_id: user._id})
      .populate('store')
      .then(function(foundUser) {
        expect(foundUser.store.toObject())
          .to.be.an('object')
          .that.includes.keys([
            "ezID",
            "name",
            "csCartID",
            "csCartServerInstance",
            "checkoutURL",
            "hasOwnCheckout",
            "isRegionalParent",
            "shouldEmailAdmin",
            "estDaysToShip"
          ]);
        done();
      })
      .catch(done);
  });

  it('can update a user', function(done) {
    var updatedAt = user.updatedAt.toString();

    user.password += "x";

    setTimeout(function() {
      user.save(function(err, saved) {
        if (err) return done(err);

        expect(saved)
          .to.be.an('object');

        expect(saved.updatedAt.toString())
          .not.to.equal(updatedAt);

        done();
      });
    }, 1000);
  });

  it('can delete a user', function(done) {
    user.remove(function(err) {
      if (err) return done(err);
      done();
    });
  });
});
