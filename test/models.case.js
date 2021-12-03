"use strict";

var chai = require('chai');
var expect = require('chai').expect;
var should = require('chai').should();

var mongoose = require('mongoose');
mongoose.Promise = global.Promise;

var Case = require('../models/Case');
var InCaseShape = require('../models/InCaseShape');

var path = require('path');
var dotenv = require('dotenv');
dotenv.config({ path:  path.resolve(__dirname, '../', '.env')});

describe('Case Model', function() {
  var _case, _inCaseShape;

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

  it('can create a new _case', function(done) {
    _case = new Case({
      name: "test",
      mcbid: "test-123",
      length: 1,
      width: 1
    });

    _case.save(function(err, _case) {
      if (err) return done(err);

      expect(_case)
        .to.be.an('object');

      expect(_case.name)
        .to.equal("test");

      expect(_case.mcbid)
        .to.equal("test-123");

      setTimeout(done, 1000);
    });
  });

  it('can update a _case', function(done) {
    var updatedAt = _case.updatedAt.toString();

    _case.length += 4;
    _case.width += 6;

    _case.save(function(err, saved) {
      if (err) return done(err);

      expect(saved)
        .to.be.an('object');

      expect(_case.length)
        .to.equal(5);

      expect(_case.width)
        .to.equal(7);

      expect(saved.updatedAt.toString())
        .not.to.equal(updatedAt);

      done();
    });
  });

  it('can find a _case', function(done) {
    Case.findOne({mcbid: "test-123"})
      .populate('inCaseShapes')
      .exec(function(err, _case) {

        expect(_case)
          .to.be.an('object');

        expect(_case.inCaseShapes)
          .to.be.an('array');

        done();
      });
  });

  it('can assign an inCaseShape', function(done) {
    _inCaseShape = new InCaseShape({
      name: "test-ics",
      case: _case._id,
      data: [],
      fromBottom: 0
    });

    var json;

    _inCaseShape.save(function(err, inCaseShape) {
      if (err) return done(err);

      _case.inCaseShapes.push(inCaseShape);

      _case.save(function(err, saved) {
        if (err) return done(err);

        expect(saved)
          .to.be.an('object');

        expect(_case.inCaseShapes)
          .to.be.an('array')
          .that.has.length.of(1);

        json = JSON.stringify(_case);

        done();
      });
    });
  });

  it('can populate a _cases inCaseShapes', function(done) {
    Case.findOne({mcbid: "test-123"})
      .populate('inCaseShapes')
      .exec(function(err, _case) {

        expect(_case)
          .to.be.an('object');

        expect(_case.inCaseShapes)
          .to.be.an('array')
          .that.has.length.of(1);

        expect(_case.inCaseShapes[0].case)
          .to.be.an('object');

        expect(_case.inCaseShapes[0].case.toString())
          .to.be.an('string')
          .that.has.length.above(1);

        done();
      });
  });

  it('can delete a _inCaseShape', function(done) {
    _inCaseShape.remove(function(err) {
      if (err) return done(err);
      done();
    });
  });

  it('can delete a _case', function(done) {
    _case.remove(function(err) {
      if (err) return done(err);
      done();
    });
  });

});
