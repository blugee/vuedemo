"use strict";

var chai = require('chai');
var expect = require('chai').expect;
var should = require('chai').should();

var mongoose = require('mongoose');
mongoose.Promise = global.Promise;

var Store = require('../models/Store');

var path = require('path');
var dotenv = require('dotenv');
dotenv.config({ path:  path.resolve(__dirname, '../', '.env')});

describe('Store Model', function() {
  var store;

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

  it('can find a store', function(done) {
    Store.findOne()
      .populate('csCartServer')
      .exec(function(err, store) {
        if (err) return done(err);

        expect(store)
          .to.be.an('object');

        expect(store.csCartServer)
          .to.be.an('object')
          .that.is.not.null;

        done();
      });
  });


});
