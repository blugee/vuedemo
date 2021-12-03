"use strict";

var mongoose = require('mongoose');
mongoose.Promise = global.Promise;

var chai = require('chai');
var expect = require('chai').expect;
var should = require('chai').should();

var Design = require('../models/Design');

var path = require('path');
var dotenv = require('dotenv');
dotenv.config({ path:  path.resolve(__dirname, '../', '.env')});

describe('Design Model', function() {
  var design;

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

  it('can create a new design', function(done) {
    design = new Design({
      name: 'test design',
      uniqueID: '9999999999'
    });
    design.save(function(err, design) {
      if (err) return done(err);

      expect(design)
        .to.be.an('object');

      setTimeout(done, 1000);
    });
  });

  it('can update a design', function(done) {
    var updatedAt = design.updatedAt.toString();

    design.name += "s";

    design.save(function(err, saved) {
      if (err) return done(err);

      expect(saved)
        .to.be.an('object');

      expect(saved.updatedAt.toString())
        .not.to.equal(updatedAt);

      done();
    });
  });

  it('can delete a design', function(done) {
    design.remove(function(err) {
      if (err) return done(err);
      done();
    });
  });
});
