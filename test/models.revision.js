"use strict";

var mongoose = require('mongoose');
mongoose.Promise = global.Promise;

var chai = require('chai');
var expect = require('chai').expect;
var should = require('chai').should();

var User = require('../models/User');
var Revision = require('../models/Revision');

var path = require('path');
var dotenv = require('dotenv');
dotenv.config({ path:  path.resolve(__dirname, '../', '.env')});

describe('Revision Model', function() {
  var revision;

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

  it('can create a new revision', function(done) {
    revision = new Revision({
      name: 'test revision'
    });
    revision.save(function(err, revision) {
      if (err) return done(err);

      expect(revision)
        .to.be.an('object');

      setTimeout(done, 1000);
    });
  });

  it('can get that revision', function(done) {
    Revision.findOne({
      _id: revision._id
    }, function(err, doc){
      if (err) return done(err);

      var revisionObject = doc.toObject();

      expect(revisionObject)
        .to.be.an('object')
        .that.includes.keys([
          'id',
          '_id',
          'name',
          'unit',
          'fileID',
          'design',
          'adminExportPdfData',
          'publicDesign',
          'createdAt',
          'updatedAt',
          '__v'
        ]);

      expect(revisionObject.customSize)
        .not.to.exist;

      expect(revisionObject.adminExportPdfData)
        .to.be.an('array')
        .that.is.empty;

      expect(revisionObject.publicDesign)
        .to.be.an('object')
        .that.includes.keys([
          'name',
          'orderNumber',
          'caseTypeOther',
          'caseType',
          'agendaJobId',
          'scheduledSendDate',
          'isSent',
          'isScheduled',
          'isCandidate'
        ]);

      done();
    });
  });

  it('can update a revision', function(done) {
    var updatedAt = revision.updatedAt.toString();

    revision.name += "s";

    revision.save(function(err, saved) {
      if (err) return done(err);

      expect(saved)
        .to.be.an('object');

      expect(saved.updatedAt.toString())
        .not.to.equal(updatedAt);

      done();
    });
  });

  it('can delete a revision', function(done) {
    revision.remove(function(err) {
      if (err) return done(err);
      done();
    });
  });

  it('can find all revisions by owner email using aggregation - paginated', function(done) {
    var search = 'joel.a.bair@gmail.com';

    let opts = {
      page: 1,
      limit: 10
    };

    var pipeline = User.aggregate([
      { "$match": {
          "email": RegExp(''+search, 'i')
      } },
      { "$lookup": {
          from: "designs",
          localField: "_id",
          foreignField: "owners",
          as: "design"
      } },
      { "$unwind" : "$design" },
      { "$lookup": {
          from: "revisions",
          localField: "design.revisions",
          foreignField: "_id",
          as: "revision"
      } },
      { "$unwind" : "$revision" },
      { "$addFields": {
          "revision.design": "$design"
      } },
      { "$replaceRoot" : {
          "newRoot": "$revision"
      } },
      { "$lookup": {
          from: "cases",
          localField: "case",
          foreignField: "_id",
          as: "case"
      } },
      { "$unwind" : "$case" }
    ]);

    User.aggregatePaginate(pipeline, opts, function(err, results) {
      if (err) return done(err);

      expect(results)
        .to.be.an('object')
        .that.includes.keys([
          'docs',
          'totalDocs',
          'limit',
          'page',
          'totalPages'
        ]);

      expect(results.docs)
        .to.be.an('array')
        .that.has.lengthOf(10);

      done();
    });
  });

});
