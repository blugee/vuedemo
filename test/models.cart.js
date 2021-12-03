"use strict";

var chai = require('chai');
var expect = require('chai').expect;
var should = require('chai').should();

var mongoose = require('mongoose');
mongoose.Promise = global.Promise;

var Cart = require('../models/Cart');
var Store = require('../models/Store');


var path = require('path');
var dotenv = require('dotenv');
dotenv.config({path: path.resolve(__dirname, '../', '.env')});

describe('Cart Model', function () {
  var cart, store;

  before(function (done) {
    /**
     * Connect to MongoDB.
     */
    mongoose.connect(process.env.MONGODB || process.env.MONGOLAB_URI, {useMongoClient: true}, done);
    mongoose.connection.on('error', function (err) {
      done(err);
    });
  });

  after(function (done) {
    mongoose.disconnect(done);
  });

  it('can create a new store', function (done) {
    store = new Store({
      name:'TEST STORE',
      ezID:'TEST',
      csCartServerInstance: 'TEST'
    });

    store.save(function (err, store) {
      if (err) return done(err);

      expect(store)
        .to.be.an('object');

      expect(store.csCartServerInstance)
        .to.equal("TEST");

      done()
    });
  });

  it('can create a new cart', function (done) {
    cart = new Cart({
      region: "test",
      apiUser: "mocha",
      apiKey: "12345"
    });

    cart.save(function (err, cart) {
      if (err) return done(err);

      expect(cart)
        .to.be.an('object');

      expect(cart.region)
        .to.equal("TEST");

      expect(cart.currency)
        .to.equal("$");

      expect(cart.baseURL)
        .to.equal("https://mycasebuilder.com/");

      setTimeout(done, 1000);
    });
  });

  it('can update a cart', function (done) {
    var updatedAt = cart.updatedAt.toString();

    cart.apiKey += "6";
    cart.baseURL += "/";

    cart.save(function (err, saved) {
      if (err) return done(err);

      expect(saved)
        .to.be.an('object');

      expect(cart.apiKey)
        .to.equal("123456");

      expect(cart.baseURL)
        .to.equal("https://mycasebuilder.com/");

      expect(saved.updatedAt.toString())
        .not.to.equal(updatedAt);

      done();
    });
  });

  it('can find a cart', function (done) {
    Cart.findOne({region: "TEST"})
      .populate('stores')
      .exec(function (err, cart) {

        expect(cart)
          .to.be.an('object');

        expect(cart.stores)
          .to.be.an('array')
          .that.has.lengthOf(1);

        done();
      });
  });

  it('can delete a cart', function (done) {
    cart.remove(function (err) {
      if (err) return done(err);
      done();
    });
  });

  it('can delete a store', function (done) {
    store.remove(function (err) {
      if (err) return done(err);
      done();
    });
  });
});
