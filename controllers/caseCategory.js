var CaseCategory = require('../models/CaseCategory');
var Store = require('../models/Store');
var Cart = require("../models/Cart");
var request = require('request');


exports.postNew = function (req, res) {
  var name = req.body.case_category_name;
  var caseCategory = new CaseCategory({
    name: name
  });
  caseCategory.save(function (err, savedCaseCategory) {
    if (!savedCaseCategory) {
      res.json({
        result: 'BAD'
      });
      return;
    }
    res.json({
      result: 'OK',
      caseCategory: savedCaseCategory
    });
  });
};
exports.caseCategories = function (req, res) {
  CaseCategory.find({}, '-_id').then(function (categories) {
    res.status(200).json({
      status: 'OK',
      data: categories
    });
  }, function (err) {
    rollbar.error(err);
    console.error(err);
    res.status(500).json({
      status: 'NOT OK',
      error: 'Error fetching Case Categories'
    });
  });
};

exports.csCartCategories = function (req, res) {
  var lang = req.params.lang || 'en';
  Cart.findOne({region:'USA'}, function(err, cart) {
    Store.findOne(req.user.store)
      .populate('csCartServer')
      .exec(function (err, store) {
        if (err) {
          console.error(err);
          res.status(500).json({
            status: 'NOT OK',
            error: 'Error fetching product data.'
          });
          return;
        }

        // defaulting to the previously fetched USA cart
        cart = (store && store.csCartServer) ? store.csCartServer : cart;

        var url = new URL(cart.baseURL);
        url.username = cart.apiUser;
        url.password = cart.apiKey;
        url.pathname = '/api/categories';
         // hard codded items_per_page=500 for now, there's +350 categories.
        url.search = '?lang_code=' + lang + '&items_per_page=500&status=A';

        request({
          // staging/development only permit un-signed/self-signed cert
          rejectUnauthorized: (process.env.NODE_ENV === 'production'),
          method: 'GET',
          url: url.toString()
        }, function (err, _res, body) {
          if (err) {
            console.error(err);
            res.status(500).json({
              status: 'NOT OK',
              error: 'Error fetching product data.'
            });
          } else {
            var _body;
            try {
              _body = JSON.parse(body);
            } catch (e) {
              console.error(e);
              console.error(body);
            }

            var categories = _body.categories.filter(function (item) {
              //TODO: find out if this will work with all CS-cart Store Instances.
              return item.company_id == 1 && item.parent_id == 53;
            });
            res.status(200).json({
              status: 'OK',
              data: categories
            });
          }
        });
      });
  });
};
