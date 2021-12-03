var Q = require('q');
var Case = require('../models/Case');
var Cart = require("../models/Cart");
var CaseCategory = require('../models/CaseCategory');
var Store = require('../models/Store');
var Part = require('../models/Part');
var InCaseShape = require('../models/InCaseShape');
var StringHelpers = require('../helpers/strings');
var _ = require('lodash');
var async = require('async');
var request = require('request');
var validator = require('validator');
/**
 * GET /
 * List of cases
 */
exports.index = function(req, res, next) {
  let page = req.query.page || req.cookies.page;
  var search = req.query.search || req.cookies.search;
  var query = {};

  var opts = {
    //sort: { name: 1 },
    populate: ['category', 'parts'],
    page: Math.max(1, parseInt(page || 1)),
    limit: Math.max(8, parseInt(req.query.size || 8)),
    //lean: true
  };

  if (!!search) {
    query['$or'] = [
      { 'name': RegExp(''+search, 'i') },
      { 'mcbid': RegExp(''+search, 'i') }
    ];
  }

  Case.paginate(query, opts, function(err, cases){
    if (err) return next(err);
    cases.search = search || '';
    if (cases.page) {
      res.cookie('page', cases.page, {path: '/cases'});
    }
    res.render('cases/index', cases);
  });
};

exports.search = function(req, res) {
  var storeParam = req.query.store;
    if(!storeParam) {storeParam = '149';}

    Store
      .findOne({ezID:storeParam})
      .populate({
        path: 'cases',
        select: '-csCartMainImg -csCartProductIDs',
        populate: [
          {
            path: 'parts',
            select: 'name case',
          },
          {
            path: 'inCaseShapes'
          }
        ]
      }).exec(function(err, foundStore){
        var cases = [];
        if(err) {
          res.json({
            'status': 'BAD',
            'message': 'Bad search'
          });
          return;
        }

        cases =
          foundStore
            .cases
            .filter(function(c){
              return c.available;
            });

        cases = _.uniqBy(cases, '_id');
        cases = _.sortBy(cases, ['name']);

        res.json(cases);
      });

};

exports.suggest = function(req, res) {
  var storeParam = req.query.store;
  var quantity = 25;
  var start = 0;
  var last = 0;
  if(!storeParam) {storeParam = '149';}
  //      match: {name: 'Pelican 1600'},

  Store
    .findOne({ezID:storeParam})
    .populate({
      path: 'cases',
      select: '-csCartProductIDs',
      options: {sort: {categoryString: 1}},
      match: {
        $and: [
          {available: true},
          {length: {$lte:req.query.maxLength}},
          {length: {$gte:req.query.minLength}},
          {width: {$lte:req.query.maxWidth}},
          {width: {$gte:req.query.minWidth}},
          {totalDepth: {$lte:req.query.maxDepth}},
          {totalDepth: {$gte:req.query.minDepth}},
        ]
      },

      populate: [
        {
          path: 'parts',
          select: 'name case',
        },
        {
          path: 'inCaseShapes'
        }
      ]
    }).exec(function(err, foundStore){
      var cases = [];
      if(err) {
        res.json({
          'status': 'BAD',
          'message': 'Bad search'
        });
        return;
      }

      cases = _.uniqBy(foundStore.cases, '_id');
      cases = _.sortBy(foundStore.cases, ['categoryString']);

      res.json(cases);
    })

};

exports.getNew = function(req, res, next) {
  CaseCategory.find(function(err, caseCategories) {

    var doneGettingServerInstanceStores = function(serverInstanceStores) {
      res.render('cases/edit', {
        action: 'new',
        caseCategories: caseCategories,
        thisCase: new Case({}),

        csCart_product_features: null,
        csCartServerInstances: Object.keys(serverInstanceStores),
        csCartStores: serverInstanceStores
      });
    };

    getServerInstanceStores(function(err, data) {
      if (err) return next(err);
      doneGettingServerInstanceStores(data);
    });
  });
};

exports.postNew = function(req, res) {
  req.assert('name', 'Name cannot be blank').notEmpty();
  req.assert('mcbid', 'MCB-ID cannot be blank').notEmpty();


  req.assert('length', 'Length cannot be blank').notEmpty();
  req.assert('length', 'Length must be a number').isFloat();

  req.assert('width', 'Width cannot be blank').notEmpty();
  req.assert('width', 'Width must be a number').isFloat();

  req.assert('lower_width', 'Lower width cannot be blank').notEmpty();
  req.assert('lower_width', 'Lower must be a number').isFloat();

  req.assert('lower_length', 'Lower length cannot be blank').notEmpty();
  req.assert('lower_length', 'Lower must be a number').isFloat();

  req.assert('base_depth', 'Base depth cannot be blank').notEmpty();
  req.assert('base_depth', 'Base must be a number').isFloat();

  req.assert('total_depth', 'Total depth cannot be blank').notEmpty();
  req.assert('total_depth', 'Total must be a number').isFloat();

  req.assert('border_width', 'Border width cannot be blank').notEmpty();
  req.assert('border_width', 'Border must be a number').isFloat();

  req.assert('corner_radius', 'Corner radius cannot be blank').notEmpty();
  req.assert('corner_radius', 'Corner must be a number').isFloat();


  req.assert('parts', 'Must provide at least 1 part').isPopulatedArray();

  var errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/cases/new');
  }
  var available = req.body.available; // type: mixed -- undefined if false or value "on" if true.
  var name = validator.trim(req.body.name); // type: string -- internal spaces OK
  var mcbid = validator.trim(req.body.mcbid).replace(/\s+/g, '_'); // type: String -- remove trailing and leading space, no internal spaces. -- hyphens allowed TODO: check if dots (period) allowed
  var length = validator.trim(req.body.length); //type: Number (float, integer) -- remove trailing and leading space
  var width = validator.trim(req.body.width); // type: Number (float, integer) -- remove trailing and leading space
  var lowerWidth = validator.trim(req.body.lower_width); // type: Number (float, integer) -- remove trailing and leading space
  var lowerLength = validator.trim(req.body.lower_length); // type: Number (float, integer) -- remove trailing and leading space
  var baseDepth = validator.trim(req.body.base_depth);  // type: Number (float, integer) -- remove trailing and leading space
  var totalDepth = validator.trim(req.body.total_depth); // type: Number (float, integer) -- remove trailing and leading space
  var borderWidth = validator.trim(req.body.border_width); // type: Number (float, integer) -- remove trailing and leading space
  var cornerRadius = validator.trim(req.body.corner_radius); // type: Number (float, integer) -- remove trailing and leading space
  var outerRule = req.body.outer_rule; // type: String -- it is not a JSON string.
  var caseCategory = validator.trim(req.body.case_category); // type: String -- remove trailing and leading space
  var parts = req.body.parts; // leave this one alone

  var newCase = new Case({
    available: available,
    name: name,
    mcbid: mcbid,
    length: length,
    width: width,
    categoryString: caseCategory ? caseCategory : '',
    lowerLength: lowerLength,
    lowerWidth: lowerWidth,
    baseDepth: baseDepth,
    totalDepth: totalDepth,
    borderWidth: borderWidth,
    cornerRadius: cornerRadius,
    outerRule: outerRule
  });
  var doneCount = 1;
  var done = function(){
    if(doneCount === parts.length){
      newCase.save(function(e){
        if (e) {
          req.flash('errors', { msg: e.errors ? JSON.stringify(e.errors) : JSON.stringify(e) });
          res.redirect('/cases');
        } else {
          req.flash('success', { msg: 'Your new case has been saved!' });
          res.redirect('/cases');
        }
      });
    } else {
      doneCount++;
    }
  };

  if(parts.length === 1 && parts[0] === '') {
    done();
  } else {
    parts.forEach(function(partName) {
      var part = new Part({
        name: partName,
        prices:[],
        options:[],
        'case': newCase
      });
      newCase.parts.push(part);
      part.save(function(){
        done();
      });
    });
  }
};

exports.postEditJSON = function(req, res) {
  var caseId = req.params.id;
  Case.update({
      _id: caseId}, {
      $set: {available: req.body.available === 'true'}
    },
    function(err, savedCase){
      if(err) {
        res.status(500).json({msg: 'Cannot update case at this time', err: err});
        return;
      }
      res.json({status: 'OK'});
    });
};

exports.getEdit = function(req, res, next) {
  Case.findOne({
    mcbid: req.params.mcbid
  })
  .populate({
    path: 'parts'
  })
  .exec(function(err, thisCase) {
    if(!thisCase) {
      res.render('404', { url: req.url });
      return;
    }

    var lang = 'en';
    if(req.query.hasOwnProperty('lang')) {
      lang = req.query.lang;
    } else if(req.query.hasOwnProperty('l')) {
      lang = req.query.l;
    }

    var user = req.user;

    var doneGettingServerInstanceStores = function(serverInstanceStores) {
      var baseProductID = thisCase.csCartProductIDs["USA"]["base"]["1"];
      var cart = serverInstanceStores['USA'].cart;

      if (baseProductID) {
        // GET requests to the CS-Cart API
        async.parallel({
          product_data: function (callback) {
            var url = new URL(cart.baseURL);
            url.username = cart.apiUser;
            url.password = cart.apiKey;
            url.pathname = '/api/products/' + baseProductID;
            url.search = '?items_per_page=100&lang_code=' + lang;

            request({
              // staging/development only permit un-signed/self-signed cert
              rejectUnauthorized: (process.env.NODE_ENV === 'production'),
              method: 'GET',
              url: url.toString()
            }, function(e, r, body) {
              if (e) {
                // TODO: Add custom lang'd error messages here
                console.log('product_data error: ', e);
                callback('Error fetching product data from CS-Cart.', null);
              } else {
                callback(null, JSON.parse(body));
              }
            });
          },
          product_features: function (callback) {
            getProductFeatures(baseProductID, lang, user, function(e, body) {
              if (e) {
                // TODO: Add custom lang'd error messages here
                console.log('product_features error: ', e);
                callback('Error fetching product features from CS-Cart.', null);
              } else {
                callback(null, body);
              }
            });
          }
        }, function(asyncErr, asyncResults) {
          var csCartError = asyncErr ? asyncErr : null;

          if (!asyncResults.product_data || asyncResults.product_data.status >= 400) {
            console.error('CSCart request error getting product data (check cart configuration)');
          }
          if (!asyncResults.product_features || asyncResults.product_features.status >= 400) {
            console.error('CSCart request error getting product features (check cart configuration)');
          }

          res.render('cases/edit',{
            action: 'edit',
            thisCase: thisCase,
            csCart_error: csCartError,
            csCart_product: asyncResults.product_data || null,
            csCart_product_features: asyncResults.product_features || null,

            csCartServerInstances: Object.keys(serverInstanceStores),
            csCartStores: serverInstanceStores
          });
        });
      } else {
        res.render('cases/edit',{
          action: 'edit',
          thisCase: thisCase,
          csCart_error: 'No CS Cart ID set.',
          csCart_product: null,
          csCart_product_features: null,

          csCartServerInstances: Object.keys(serverInstanceStores),
          csCartStores: serverInstanceStores
        });
      }

    };

    getServerInstanceStores(function(err, data, carts) {
      if (err) return next(err);

      // Set the format of thisCase.csCartProductIDs in the event that it's empty.
      thisCase.csCartProductIDs = getBlankCsCartProductIdsObj(thisCase, carts);

      doneGettingServerInstanceStores(data);
    });
  });
};

exports.postEdit = function(req, res) {
  req.assert('name', 'Name cannot be blank').notEmpty();
  req.assert('mcbid', 'MCB-ID cannot be blank').notEmpty();


  req.assert('length', 'Length cannot be blank').notEmpty();
  req.assert('length', 'Length must be a number').isFloat();

  req.assert('width', 'Width cannot be blank').notEmpty();
  req.assert('width', 'Width must be a number').isFloat();

  req.assert('lower_width', 'Lower width cannot be blank').notEmpty();
  req.assert('lower_width', 'Lower must be a number').isFloat();

  req.assert('lower_length', 'Lower length cannot be blank').notEmpty();
  req.assert('lower_length', 'Lower must be a number').isFloat();

  req.assert('base_depth', 'Base depth cannot be blank').notEmpty();
  req.assert('base_depth', 'Base must be a number').isFloat();

  req.assert('total_depth', 'Total depth cannot be blank').notEmpty();
  req.assert('total_depth', 'Total must be a number').isFloat();

  req.assert('border_width', 'Border width cannot be blank').notEmpty();
  req.assert('border_width', 'Border must be a number').isFloat();


  req.assert('corner_radius', 'Corner radius cannot be blank').notEmpty();
  req.assert('corner_radius', 'Corner must be a number').isFloat();

  var errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/cases/edit/' + req.body.mcbid);
  }

  var available = validator.toBoolean(req.body.available);  // type: mixed -- undefined if false or value "on" if true. -- using toBoolean to coerce to real true / false.
  var name = validator.trim(req.body.name); // type: string -- internal spaces OK
  var mcbid = validator.trim(req.body.mcbid).replace(/\s+/g, '_'); // type: String -- remove trailing and leading space, no internal spaces.
  var length = validator.trim(req.body.length); //type: Number (float, integer) -- remove trailing and leading space
  var width = validator.trim(req.body.width); // type: Number (float, integer) -- remove trailing and leading space
  var lowerWidth = validator.trim(req.body.lower_width); // type: Number (float, integer) -- remove trailing and leading space
  var lowerLength = validator.trim(req.body.lower_length); // type: Number (float, integer) -- remove trailing and leading space
  var baseDepth = validator.trim(req.body.base_depth);  // type: Number (float, integer) -- remove trailing and leading space
  var totalDepth = validator.trim(req.body.total_depth); // type: Number (float, integer) -- remove trailing and leading space
  var borderWidth = validator.trim(req.body.border_width); // type: Number (float, integer) -- remove trailing and leading space
  var cornerRadius = validator.trim(req.body.corner_radius); // type: Number (float, integer) -- remove trailing and leading space
  var outerRule = req.body.outer_rule; // type: String -- it is not a JSON string.
  var caseCategory = validator.trim(req.body.case_category); // type: String -- remove trailing and leading space
  var caseBrand = validator.trim(req.body.case_brand); // type: String -- remove trailing and leading space
  var parts = req.body.parts; // leave this one alone
  var oldParts = req.body.old_parts; // leave this one alone.

  var csCartMainImg = '';

  /*
    NOTE: CS Cart productIDs come in the following format:

        "productID"-[server instance]-[caseType]-[CS Cart store ID] === product_id for that store

    For example:

        req.body = {
          ...
          'productID-USA-foamOnly-1': 13,
          'productID-EUR-caseAndFoam-5': 24,
          ...
        }

    We also pass in "csCartBaseID", which is always in the USA server on store #1.
  */

  var csCartBaseID = req.body.csCartBaseID;

  var productIDkeys = [];
  var keyPrefix = 'productID-';
  Object.keys(req.body).forEach(function(key) {
    if (req.body.hasOwnProperty(key) &&
      key.slice(0, keyPrefix.length) === keyPrefix) {
      productIDkeys.push({
        'key': key,
        'product_id': req.body[key]
      });
    }
  });

  var doneFetchingCaseImage = function(carts) {
    Case.findOne({
      mcbid: req.params.mcbid
    })
      .populate('parts')
      .populate('inCaseShapes')
      .exec(function(err, thisCase){
        if(!thisCase) {
          res.render('404', { url: req.url });
          return;
        }
        thisCase.available = available;
        thisCase.name = name;
        thisCase.mcbid = mcbid;
        thisCase.length = length;
        thisCase.width = width;
        thisCase.lowerLength = lowerLength;
        thisCase.lowerWidth = lowerWidth;
        thisCase.baseDepth = baseDepth;
        thisCase.totalDepth = totalDepth;
        thisCase.borderWidth = borderWidth;
        thisCase.cornerRadius = cornerRadius;
        thisCase.outerRule = outerRule;
        thisCase.csCartMainImg = csCartMainImg;
        thisCase.categoryString = caseCategory;
        thisCase.brandString = caseBrand;

        // Insert all CS-Cart product IDs.
        // Call this first in the event that csCartProductIDs is empty.
        thisCase.csCartProductIDs = getBlankCsCartProductIdsObj(thisCase, carts);

        // csCartProductIDs.USA.base.1 is the default store for the base product ID.
        thisCase.csCartProductIDs['USA']['base']['1'] = parseInt(csCartBaseID);

        productIDkeys.forEach(function(productIDkey) {
          // NOTE: refer to the key format above.
          var elements = productIDkey['key'].split('-').slice(1);
          if (elements.length === 3) {
            if (productIDkey['product_id']) {
              thisCase.csCartProductIDs[elements[0]][elements[1]][elements[2]] = parseInt(productIDkey['product_id']);
            } else {
              if (thisCase.csCartProductIDs[elements[0]][elements[1]].hasOwnProperty([elements[2]])) {
                delete thisCase.csCartProductIDs[elements[0]][elements[1]][elements[2]];
              }
            }
          }
        });

        // Mongoose-ism for "Mixed" fields:
        thisCase.markModified('csCartProductIDs');

        var oldPartsSave = [];
        var newPartsSave = [];
        var doneSavingNewParts = false;
        var doneSavingOldParts = false;

        function saveCase() {
          thisCase.save(function(err){
            if(err){
              console.log(err);
              req.flash('info', { msg: 'Could not save. Validation error.' });
              res.redirect('/cases/edit/' + thisCase.mcbid);
            } else {
              req.flash('success', { msg: 'Your case has been edited!' });
              res.redirect('/cases' + '#' + thisCase.mcbid);
            }
          });
        }

        function doneNewParts(){
          if(parts.length === newPartsSave.length && !doneSavingNewParts){
            doneSavingNewParts = true;
            async.parallel(newPartsSave, function(){
              setTimeout(function(){
                saveCase();
              },0);
            });
          }
        }

        function doNewParts(){
          parts.forEach(function(p){
            var hasPart = thisCase.parts.some(function(cp){
              return cp.name === p;
            });
            if(!hasPart){
              var newPart = new Part({
                name: p,
                case: thisCase
              });
              thisCase.parts.push(newPart);
              newPartsSave.push(newPart.save);
            } else {
              newPartsSave.push(function(callback){
                callback(null,null);
              });
            }
            setTimeout(function(){
              doneNewParts();
            },0);
          });
        }

        function doneOldParts(){
          if(oldPartsSave.length === Object.keys(oldParts).length && !doneSavingOldParts){
            doneSavingOldParts = true;
            async.parallel(oldPartsSave, function(){
              setTimeout(function(){
                if(parts && parts.length){
                  doNewParts();
                } else {
                  parts = [];
                  doneNewParts();
                }
              });
            });
          }
        }
        function doOldParts(){
          _.forOwn(oldParts, function(value, key) {
            Part.findOne({_id: key}, function(err, foundPart){
              if(foundPart.name !== value){
                foundPart.name = value;
                oldPartsSave.push(foundPart.save);
              } else {
                oldPartsSave.push(function(callback){
                  callback(null,null);
                });
              }
              setTimeout(function(){
                doneOldParts();
              },0);

            });
          });
        }
        setTimeout(function(){
          doOldParts();
        },0);
      });
  };

  Cart.find()
    .exec(function(err, carts) {
      if (err) console.warn(err);
      carts = carts || [];

      // fetch case img here
      if (req.body.csCartMainImg) {
        // Source: https://stackoverflow.com/questions/17124053/node-js-get-image-from-web-and-encode-with-base64
        var requestImg = require('request').defaults({ encoding: null });
        requestImg.get(req.body.csCartMainImg, function (error, response, body) {
          if (!error && response.statusCode === 200) {
            csCartMainImg = "data:" + response.headers["content-type"] + ";base64," + new Buffer(body).toString('base64');
          } else {
            // error, do nothing.
            console.log('error fetching image: ', error);
          }
          doneFetchingCaseImage(carts);
        });
      } else {
        doneFetchingCaseImage(carts);
      }
    });
};

exports.postInCaseShapeJSON = function(req, res, next) {
  // get that case.
  Case.findOne({
    _id: req.params.id
  })
  .exec(function(err, thisCase) {
    if(err || !thisCase) {
      res.status(401).json({msg: 'That case is not available'});
      return next(err||new Error('Case not found!'));
    }
    var newInCaseShape = new InCaseShape({
      data: req.body.data,
      fromBottom: req.body.fromBottom,
      case: thisCase._id
    });

    newInCaseShape.save(function(err, savedInCaseShape) {
      if(err) {
        res.status(500).json({msg: 'Your in case cannot be saved at this time'});
        return next(err);
      }
      thisCase.inCaseShapes.push(savedInCaseShape);
      thisCase.save(function(err, savedCase) {
        if(err) {
          res.status(500).json({msg: 'Your in case cannot be saved at this time'});
          return next(err);
        }
        return res.json(savedCase);
      });
    });
  });
};

exports.deleteInCaseShapeJSON = function(req, res, next) {
  Case.findOne({
    _id: req.params.id
  })
  .populate('inCaseShapes')
  .exec(function(err, foundCase) {
    if(err || !foundCase) {
      res.status(401).json({msg: 'That case cannot be found at this time.'});
      return next(err||new Error('Case not found!'));
    }

    foundCase.inCaseShapes.forEach(function(inCaseShape){
      inCaseShape.remove();
    });

    foundCase.inCaseShapes = [];
    foundCase.save(function(err, savedCase){
      if(err || !savedCase) {
        res.status(401).json({msg: 'That case cannot be saved at this time.', err: err});
        return next(err);
      }
      res.json(savedCase);
    });
  });
};

exports.getProductDataJSON = function(req, res, next) {
  // These defaults may get overridden below.
  var userStoreKey = 'USA';
  var userStoreCartID = 1;

  var doneSettingStoreKey = function() {
    Cart.find()
      .populate('stores')
      .exec(function(err, carts) {
        if (err) console.warn(err);

        var csCartServers = {};
        carts.forEach(function(cart) {
          csCartServers[cart.region] = cart;
        });

        var cart = csCartServers[userStoreKey];

        var customCartStoreIds = {
          "USA":"17",
          "EUR":"640",
          "JPN":"17"
        };

        var customProductId = customCartStoreIds[userStoreKey] || "17";

        if (req.params.mcbid === 'custom') {
          // handle "custom" case product data here
          async.parallel({
            customFoamOptions: function (callback) {
              var url = new URL(cart.baseURL);
              url.username = cart.apiUser;
              url.password = cart.apiKey;
              url.pathname = '/api/options/';
              url.search = '?product_id=' + customProductId + '&lang_code=' + req.params.lang;

              request({
                // staging/development only permit un-signed/self-signed cert
                rejectUnauthorized: (process.env.NODE_ENV === 'production'),
                method: 'GET',
                url: url.toString()
              }, function(e, r, body) {
                if (e) {
                  callback('Error fetching product data from CS-Cart.', null);
                } else {
                  var out = {};
                  try {
                    out = JSON.parse(body);
                  } catch (err) {
                    console.error(err);
                  }
                  callback(null, out);
                }
              });
            },
            customFoamData: function(callback) {
              var url = new URL(cart.baseURL);
              url.username = cart.apiUser;
              url.password = cart.apiKey;
              url.pathname = '/api/products/' + customProductId;
              url.search = '?lang_code=' + req.params.lang;

              request({
                // staging/development only permit un-signed/self-signed cert
                rejectUnauthorized: (process.env.NODE_ENV === 'production'),
                method: 'GET',
                url: url.toString()
              }, function(e, r, body) {
                if (e) {
                  callback('Error fetching product data.', null);
                } else {
                  var out = {};
                  try {
                    out = JSON.parse(body);
                  } catch (err) {
                    console.error(err);
                  }
                  callback(null, out);
                }
              });
            }
          },
          function(asyncErr, asyncResults) {
            if (asyncErr) {
              return next(asyncErr);
            }
            return res.json(asyncResults);
          });
        } else {
          Case.findOne({
            mcbid: req.params.mcbid
          })
          .select('csCartProductIDs')
          .exec(function(err, foundCase) {
            if (err || !foundCase) {
              return res.status(401).json({msg: 'Cannot find case', err: err});
            }

            if (!foundCase.csCartProductIDs ||
              !foundCase.csCartProductIDs[userStoreKey] ||
              !foundCase.csCartProductIDs[userStoreKey]['caseAndFoam'] ||
              !foundCase.csCartProductIDs[userStoreKey]['foamOnly']) {
              return res.status(404).json({msg: 'This case does not have product data associated with it.'});
            } else {

              var caseAndFoamProductID = foundCase.csCartProductIDs[userStoreKey]['caseAndFoam'][userStoreCartID];
              var foamOnlyProductID = foundCase.csCartProductIDs[userStoreKey]['foamOnly'][userStoreCartID];

              async.parallel({
                caseAndFoamOptions: function(callback) {
                  var url = new URL(cart.baseURL);
                  url.username = cart.apiUser;
                  url.password = cart.apiKey;
                  url.pathname = '/api/options/';

                  if (caseAndFoamProductID) {
                    url.search = '?product_id=' + caseAndFoamProductID + '&lang_code=' + req.params.lang;

                    request({
                      // staging/development only permit un-signed/self-signed cert
                      rejectUnauthorized: (process.env.NODE_ENV === 'production'),
                      method: 'GET',
                      url: url.toString()
                    }, function(e, r, body) {
                      if (e) {
                        callback('Error fetching product data from CS-Cart (Case-And-Foam-Options). ' + url.toString(), null);
                      } else {
                        var out = {};
                        try {
                          out = JSON.parse(body);
                        } catch (err) {
                          console.error(err);
                        }
                        callback(null, out );
                      }
                    });
                  } else {
                    callback(null, {});
                  }
                },
                foamOnlyOptions: function(callback) {
                  var url = new URL(cart.baseURL);
                  url.username = cart.apiUser;
                  url.password = cart.apiKey;
                  url.pathname = '/api/options/';

                  if (foamOnlyProductID) {
                    url.search = '?product_id=' + foamOnlyProductID + '&lang_code=' + req.params.lang;
                    request({
                      // staging/development only permit un-signed/self-signed cert
                      rejectUnauthorized: (process.env.NODE_ENV === 'production'),
                      method: 'GET',
                      url: url.toString()
                    }, function(e, r, body) {
                      if (e) {
                        callback('Error fetching product data from CS-Cart (Foam-Only-Options). ' + url.toString(), null);
                      } else {
                        var out = {};
                        try {
                          out = JSON.parse(body);
                        } catch (err) {
                          console.error(err);
                        }
                        callback(null, out );
                      }
                    });
                  } else {
                    callback(null, {});
                  }
                },
                caseAndFoamData: function(callback) {
                  var url = new URL(cart.baseURL);
                  url.username = cart.apiUser;
                  url.password = cart.apiKey;
                  url.search = '?lang_code=' + req.params.lang;

                  if (caseAndFoamProductID) {
                    url.pathname = '/api/products/' + caseAndFoamProductID;
                    request({
                      // staging/development only permit un-signed/self-signed cert
                      rejectUnauthorized: (process.env.NODE_ENV === 'production'),
                      method: 'GET',
                      url: url.toString()
                    }, function(e, r, body) {
                      if (e) {
                        callback('Error fetching product data from CS-Cart (Case-And-Foam-Data). ' + url.toString(), null);
                      } else {
                        var out = {};
                        try {
                          out = JSON.parse(body);
                        } catch (err) {
                          console.error(err);
                        }
                        callback(null, out );
                      }
                    });
                  } else {
                    callback(null, {});
                  }
                },
                foamOnlyData: function(callback) {
                  var url = new URL(cart.baseURL);
                  url.username = cart.apiUser;
                  url.password = cart.apiKey;
                  url.search = '?lang_code=' + req.params.lang;

                  if (foamOnlyProductID) {
                    url.pathname = '/api/products/' + foamOnlyProductID;
                    request({
                      // staging/development only permit un-signed/self-signed cert
                      rejectUnauthorized: (process.env.NODE_ENV === 'production'),
                      method: 'GET',
                      url: url.toString()
                    }, function(e, r, body) {
                      if (e) {
                        callback('Error fetching product data from CS-Cart (Foam-Only-Data). ' + url.toString(), null);
                      } else {
                        var out = {};
                        try {
                          out = JSON.parse(body);
                        } catch (err) {
                          console.error(err);
                        }
                        callback(null, out );
                      }
                    });
                  } else {
                    callback(null, {});
                  }
                },
              }, function(asyncErr, asyncResults) {
                  if (asyncErr) {
                  return next(new Error(asyncErr));
                }
                res.json(asyncResults);
              });
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
      .exec(function(err, foundStore) {
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

exports.getProductListDataJSON = function (req, res, next) {
  // These defaults may get overridden below.
  var userStoreKey = 'USA';
  var userStoreCartID = 1;
  var featuresUserStoreKey = 'USA';
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
        var usaCart = csCartServers['USA'];
        var customCartStoreIds = {
          "USA": "17",
          "EUR": "640",
          "JPN": "17"
        };

        var customProductId = customCartStoreIds[userStoreKey] || "17";

        if (req.params.mcbid === 'custom') {
          // handle "custom" case product data here
          async.parallel({
            customFoamOptions: function (callback) {
              var url = new URL(cart.baseURL);
              url.username = cart.apiUser;
              url.password = cart.apiKey;
              url.pathname = '/api/options/';
              url.search = '?product_id=' + customProductId + '&lang_code=' + req.params.lang;

              request({
                // staging/development only permit un-signed/self-signed cert
                rejectUnauthorized: (process.env.NODE_ENV === 'production'),
                method: 'GET',
                url: url.toString()
              }, function (e, r, body) {
                if (e) {
                  callback('Error fetching product data from CS-Cart.', null);
                } else {
                  var out = {};
                  try {
                    out = JSON.parse(body);
                  } catch (err) {
                    console.error(err);
                  }
                  callback(null, out);
                }
              });
            },
            customFoamData: function (callback) {
              var url = new URL(cart.baseURL);
              url.username = cart.apiUser;
              url.password = cart.apiKey;
              url.pathname = '/api/products/' + customProductId;
              url.search = '?lang_code=' + req.params.lang;

              request({
                // staging/development only permit un-signed/self-signed cert
                rejectUnauthorized: (process.env.NODE_ENV === 'production'),
                method: 'GET',
                url: url.toString()
              }, function (e, r, body) {
                if (e) {
                  callback('Error fetching product data.', null);
                } else {
                  var out = {};
                  try {
                    out = JSON.parse(body);
                  } catch (err) {
                    console.error(err);
                  }
                  callback(null, out);
                }
              });
            }
          },
            function (asyncErr, asyncResults) {
              if (asyncErr) {
                return next(asyncErr);
              }
              return res.json(asyncResults);
            });
        } else {
          
          var mcbid = JSON.parse(req.params.mcbid)
          Case.find({
            mcbid: { $in: mcbid },
          })
            .select('csCartProductIDs')
            .select('mcbid')
            .exec(function (err, foundCase) {
              if (err || !foundCase) {
                return res.status(401).json({ msg: 'Cannot find case', err: err });
              }
              let caseData = []
              let mcbIdList=[]
              for (let index = 0; index < foundCase.length; index++) {
                if (foundCase[index].csCartProductIDs &&
                  foundCase[index].csCartProductIDs[userStoreKey] &&
                  foundCase[index].csCartProductIDs[userStoreKey]['caseAndFoam'] && 
                  foundCase[index].csCartProductIDs[userStoreKey]['caseAndFoam'][userStoreCartID]) {
                    mcbIdList.push({productId : foundCase[index].csCartProductIDs[userStoreKey]['caseAndFoam'][userStoreCartID], featuresId : foundCase[index].csCartProductIDs[featuresUserStoreKey]['base'][userStoreCartID], mcbId : foundCase[index].mcbid })
                    caseData.push(foundCase[index])
                }
              }
              if (caseData && caseData.length > 0) {
                var caseAndFoamProductID = ''
                var featuresProductID = []
                for (let i = 0; i < caseData.length; i++) {
                  caseAndFoamProductID = caseAndFoamProductID + caseData[i].csCartProductIDs[userStoreKey]['caseAndFoam'][userStoreCartID];
                  if (caseData[i].csCartProductIDs[featuresUserStoreKey]['base'][userStoreCartID]) {
                    featuresProductID.push(caseData[i].csCartProductIDs[featuresUserStoreKey]['base'][userStoreCartID])
                  }
                  if (i !== (caseData.length - 1)) {
                    caseAndFoamProductID = caseAndFoamProductID + ',';
                  }
                }
                async.parallel({
                  caseAndFoamOptions: function (callback) {
                    var url = new URL(cart.baseURL);
                    url.username = cart.apiUser;
                    url.password = cart.apiKey;
                    url.pathname = '/api/OptionsList/';
                    if (caseAndFoamProductID) {
                      url.search = '?product_id=' + caseAndFoamProductID + '&lang_code=' + req.params.lang;
                      request({
                        // staging/development only permit un-signed/self-signed cert
                        rejectUnauthorized: (process.env.NODE_ENV === 'production'),
                        method: 'GET',
                        url: url.toString()
                      }, function (e, r, body) {
                        if (e) {
                          callback('Error fetching product data from CS-Cart (Case-And-Foam-Options). ' + url.toString(), null);
                        } else {
                          var out = {};
                          try {
                            out = JSON.parse(body);
                          } catch (err) {
                            console.error(err);
                          }
                          callback(null, out);
                        }
                      });
                    } else {
                      callback(null, {});
                    }
                  },
                  caseAndFoamData: function (callback) {
                    var url = new URL(cart.baseURL);
                    url.username = cart.apiUser;
                    url.password = cart.apiKey;
                    // url.search = '&lang_code=' + req.params.lang;
                    url.pathname = '/api/ProductsList/';
                    if (caseAndFoamProductID) {
                      url.search = '?product_id=' + caseAndFoamProductID + '&lang_code=' + req.params.lang;
                      request({
                        // staging/development only permit un-signed/self-signed cert
                        rejectUnauthorized: (process.env.NODE_ENV === 'production'),
                        method: 'GET',
                        url: url.toString()
                      }, function (e, r, body) {
                        if (e) {
                          callback('Error fetching product data from CS-Cart (Case-And-Foam-Data). ' + url.toString(), null);
                        } else {
                          var out = [];
                          try {
                            out = JSON.parse(body);
                            if (out && out.length > 0) {
                              for (let j = 0; j < out.length; j++) {
                                let selectedCase = mcbIdList.filter(item=>item.productId ===out[j].product_id )
                                if(selectedCase && selectedCase.length >0) {
                                  out[j] ={...out[j], mcbId : selectedCase[0].mcbId, featureId: selectedCase[0].featuresId }
                                }
                              }
                            }
                          } catch (err) {
                            console.error(err);
                          }
                          callback(null, out);
                        }
                      });
                    } else {
                      callback(null, {});
                    }
                  },
                  features: function (callback) {
                    var url = new URL(usaCart.baseURL);
                    url.username = usaCart.apiUser;
                    url.password = usaCart.apiKey;
                    // url.search = '&lang_code=' + req.params.lang;
                    url.pathname = '/api/ProductsFeatures/';
                    if (featuresProductID) {
                      url.search = '?product_ids=[' + featuresProductID + ']&variants=true&items_per_page=100&lang_code=' + req.params.lang;
                      request({
                        // staging/development only permit un-signed/self-signed cert
                        rejectUnauthorized: (process.env.NODE_ENV === 'production'),
                        method: 'GET',
                        url: url.toString()
                      }, function (e, r, body) {
                        if (e) {
                          callback('Error fetching product data from CS-Cart (Case-And-Foam-Data). ' + url.toString(), null);
                        } else {
                          var out = [];
                          try {
                            out = JSON.parse(body);
                          } catch (err) {
                            console.error(err);
                          }
                          callback(null, out);
                        }
                      });
                    } else {
                      callback(null, {});
                    }
                  },
                }, function (asyncErr, asyncResults) {
                  if (asyncErr) {
                    return next(new Error(asyncErr));
                  }
                  res.json(asyncResults);
                });
              } else {
                return res.status(404).json({ msg: 'This case does not have product data associated with it.' });
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

exports.getProductFeaturesJSON = function(req, res, next) {
  var lang = 'en';
  if(req.query.hasOwnProperty('lang')) {
    lang = req.query.lang;
  } else if(req.query.hasOwnProperty('l')) {
    lang = req.query.l;
  }

  var user = req.user;

  // NOTE: we don't currently use the :mcbid URL param in this method,
  // but use it in the future as a fallback if baseProductID is not provided.
  getProductFeatures(req.query.baseProductID, lang, user, function(err, body) {
    if (err||!body) {
      return next(err||new Error('Error fetching product features from CS-Cart.'));
    }
    res.json(body||[]);
  });
};

var getProductFeatures = function(baseProductID, lang, user, callback) {
  var userStore = user.currentStore();

  Store.findOne({_id: userStore})
    .populate('csCartServer')
    .exec(function(err, store) {
      if (err) console.warn(err);

      if (!store.csCartServer) {
        return callback(new Error('Error locating CS-Cart configuration.'));
      }

      var cart = store.csCartServer;
      var url = new URL(cart.baseURL);
      url.username = cart.apiUser;
      url.password = cart.apiKey;
      url.pathname = '/api/products/' + baseProductID + '/features/';
      url.search = '?items_per_page=100&lang_code=' + lang;

      request({
        // staging/development only permit un-signed/self-signed cert
        rejectUnauthorized: (process.env.NODE_ENV === 'production'),
        method: 'GET',
        url: url.toString()
      }, function(e, r, body) {
        r = r || { statusCode: 500, request: { uri: url.toString() } };
        if (e) {
          console.error(r.request.uri);
          console.warn(e, r.statusCode);
          callback(e, null);
        } else {
          callback(null, JSON.parse(body).features);
        }
      });
    });
};

exports.getProductCodes = function(req, res, next) {
  var strippedMcbid = req.params.mcbid ? req.params.mcbid.split('-').join('').toLowerCase() : '';
  var storeIds = req.query.storeIds;
  var apiUrls = [];

  if (storeIds) {
    Cart.find()
      .populate('stores')
      .exec(function(err, carts) {
        if (err) console.warn(err);

        var csCartServers = {};
        carts.forEach(function(cart) {
          csCartServers[cart.region] = cart;
        });

        Object.keys(storeIds).forEach(function(serverKey) {
          if (storeIds.hasOwnProperty(serverKey)) {
            if (csCartServers[serverKey]) {
              var cart = csCartServers[serverKey];
              storeIds[serverKey].forEach(function(storeId) {
                var url = new URL(cart.baseURL);
                url.username = cart.apiUser;
                url.password = cart.apiKey;
                url.pathname = '/api/stores/' + storeId + '/products/';
                url.search = '?items_per_page=25&pcode=' + strippedMcbid;

                // Use the metadata (serverKey and storeId) along with URLs below.
                apiUrls.push({
                  serverKey: serverKey,
                  storeId: storeId,
                  url: url.toString()
                });
              });
            }
          }
        });

        // Get data from each API url in parallel.
        var callObj = {};
        apiUrls.forEach(function(urlData) {
          callObj[urlData.serverKey + '_' + urlData.storeId] = function(asyncCallback) {
            request({
              // staging/development only permit un-signed/self-signed cert
              rejectUnauthorized: (process.env.NODE_ENV === 'production'),
              method: 'GET',
              url: urlData.url
            }, function(e, r, body) {
              if (e) {
                asyncCallback(e, null);
              } else {
                asyncCallback(null, JSON.parse(body));
              }
            });
          }
        });

        let isMatchingProductCode = function(code) {
          let strippedCode = code.split('-').join('').toLowerCase();

          if (strippedCode === strippedMcbid || strippedCode === (strippedMcbid + "cf") || strippedCode === (strippedMcbid + "fo")) {
            return true
          } else {
            return false;
          }
        };

        async.parallel(callObj, function(asyncErr, asyncResults) {
          if (asyncErr) {
            return next(asyncErr);
          }

          var result = {};

          Object.keys(asyncResults).forEach(function(resultKey) {
            if (asyncResults.hasOwnProperty(resultKey)) {
              var productIdsForStore = [];

              if (asyncResults[resultKey] && asyncResults[resultKey].products) {
                asyncResults[resultKey].products.forEach(function(product) {

                  // since CS-Cart uses fuzzy matching with the product code search query, we need to manually
                  // filter the results so we only push products that match req.params.mcbid (+ "-fo" and "-cf").
                  if (isMatchingProductCode(product.product_code)) {
                    productIdsForStore.push({
                      product_id: product.product_id,
                      product_code: product.product_code
                    });
                  }
                });
              }
              result[resultKey] = productIdsForStore;
            }
          });
          return res.json(result);
        });
      });
  } else {
    return res.status(422);
  }
};

exports.getAllProductCodes = function(req, res, next) {
  return;  // NOTE: getAllProductCodes and setAllProductCodes are dangerous. Use only when necessary.

  var doneProcessingMcbids = function(processedMcbids) {
    return res.json(processedMcbids);
  };

  var doneGettingCaseMcbids = function(mcbids, storeIds) {
    if (storeIds) {

      // strip hyphens from the mcbids to allow
      // for slightly inconsistent CS-Cart data
      var strippedMcbids = mcbids.map(function(id) {
        return id.split('-').join('').toLowerCase();
      });
      // Repeat a process similar to getProductCodes() for each mcbid.

      // Build URLs that we'll query for products in each individual store.
      var apiUrls = [];

      Cart.find()
        .populate('stores')
        .exec(function(err, carts) {
          if (err) console.warn(err);

          var csCartServers = {};
          carts.forEach(function(cart) {
            csCartServers[cart.region] = cart;
          });

          Object.keys(storeIds).forEach(function(serverKey) {
            if (storeIds.hasOwnProperty(serverKey)) {
              if (csCartServers[serverKey]) {
                var cart = csCartServers[serverKey];
                storeIds[serverKey].forEach(function(storeId) {
                  var url = new URL(cart.baseURL);
                  url.username = cart.apiUser;
                  url.password = cart.apiKey;
                  url.pathname = '/api/stores/' + storeId + '/products/';
                  url.search = '?items_per_page=2000';
                  // TODO: increase page size if we add more than 2000 cases to CS-Cart

                  apiUrls.push({
                    serverKey: serverKey,
                    storeId: storeId,
                    url: url.toString()
                  });
                });
                  }
            }
          });

          // Get data from each API url in parallel.
          var callObj = {};
          apiUrls.forEach(function(urlData) {
            callObj[urlData.serverKey + '_' + urlData.storeId] = function(asyncCallback) {
              request({
                // staging/development only permit un-signed/self-signed cert
                rejectUnauthorized: (process.env.NODE_ENV === 'production'),
                method: 'GET',
                url: urlData.url
              }, function(e, r, body) {
                if (e) {
                  console.log('Error when getting store products asynchronously: ', e);
                  asyncCallback(e, null);
                } else {
                  asyncCallback(null, JSON.parse(body));
                }
              });
            }
          });

          async.parallel(callObj, function(asyncErr, asyncResults) {
            if (asyncErr) {
              console.log('asyncErr: ', asyncErr);
              return res.status(500);
            } else {
              var result = {};

              // Only match against req.params.mcbid (+ "-fo" and "-cf"), and
              // filter to only product ids and product codes.
              Object.keys(asyncResults).forEach(function(resultKey) {
                if (asyncResults.hasOwnProperty(resultKey)) {

                  var productIdsForStore = [];

                  if (asyncResults[resultKey] && asyncResults[resultKey].products) {
                    asyncResults[resultKey].products.forEach(function(product) {

                      productIdsForStore.push({
                        product_id: product.product_id,
                        product_code: product.product_code
                      });

                    });
                  }

                  result[resultKey] = productIdsForStore;

                }
              });

              doneProcessingMcbids(result);
            }
          });
        });

    } else {
      next(new Error('error, no storeIds'));
    }
  };

  var doneGettingServerInstanceStores = function(serverInstanceStores) {
    Case.find()
      .select({ mcbid: 1 })
      .lean()
      .exec(function(err, cases){

        var mcbids =
          cases
            .filter(function(kase) {
              return kase.mcbid;
            })
            .map(function(kase) {
              return kase.mcbid;
            });

        var minimalStoreIds = {};
        Object.keys(serverInstanceStores).forEach(function (key) {
          if (serverInstanceStores.hasOwnProperty(key)) {
            var storeIdArr = [];

            if (serverInstanceStores[key].stores && serverInstanceStores[key].stores.length > 0) {
              serverInstanceStores[key].stores.forEach(function (store) {
                if (store.company_id) {
                  storeIdArr.push(store.company_id);
                }
              });
            }

            minimalStoreIds[key] = storeIdArr;
          }
        });

        doneGettingCaseMcbids(mcbids, minimalStoreIds);
      });
  };

  getServerInstanceStores(function(err, data, carts) {
    if (err) return next(err);
    doneGettingServerInstanceStores(data);
  });

};

exports.setAllProductCodes = function(req, res) {
  return;  // NOTE: getAllProductCodes and setAllProductCodes are dangerous. Use only when necessary.
  /*
  req.body.products format:

  {
    USA_1: [
      { product_id: "29", product_code: "AG-2pistol" },
      { ... }
    ],
    EUR_5: [
      ...
    ],
    ...
  }

  */

  // Reformat into a single list of all mcbids
  var products = req.body.products;
  var reformattedProducts = {};

  Object.keys(products).forEach(function(serverKey) {  // serverKey = "USA_1"
    if (products.hasOwnProperty(serverKey)) {
      products[serverKey].forEach(function(product) {  // product = { product_id: "29", product_code: "AG-2pistol-fo" }

        var productCode = product.product_code.toLowerCase();
        var baseProductCode = productCode;

        var mode = 'base';  // "mode" is a quick-n-dirty way of encoding whether we're working with a "base" case, "foam only" case, or "case and foam" case.
        var slicedCode = productCode.slice(0, -3);
        var suffix = productCode.slice(-3);
        if (suffix === '-fo') {
          mode = 'foamOnly';
          baseProductCode = slicedCode;
        } else if (suffix === '-cf') {
          mode = 'caseAndFoam';
          baseProductCode = slicedCode
        }

        if (!reformattedProducts[baseProductCode]) {
          reformattedProducts[baseProductCode] = {};
        }
        if (!reformattedProducts[baseProductCode][mode]) {
          reformattedProducts[baseProductCode][mode] = [];
        }
        reformattedProducts[baseProductCode][mode].push({
          serverKey: serverKey,
          productId: product.product_id
        });
      });
    }
  });


  /*

  reformattedProducts format (one key per mcbid):
  {
    "AG-2pistol": {
      "caseAndFoam": [
        { serverKey: "USA_1", productCode: "29" },
        { serverKey: "EUR_5", productCode: "3" },
        ...
      ],
      "foamOnly": [
        { serverKey: "USA_1", productCode: "29" },
        { serverKey: "EUR_5", productCode: "3" },
        ...
      ],
      "base": [
        { serverKey: "USA_1", productCode: "13" }
      ]
    },
    ...
  }

  */

  // Now, query for matching cases in Mongo and save the appropriate product codes.

  // NOTE: there does not appear to be a good way to use either
  // Mongo's text search or regex operators to find cases that match
  // the mcbid irrespective of hyphens or capitalization.

  // The hacky solution for the meantime is generating likely (hyphenated) permutations
  // of each mcbid and $or-ing them in a case-insensitive Mongo query.


  // use callObj for the async.parallel call
  var callObj = {};


  Object.keys(reformattedProducts).forEach(function(productKey) {  // productKey = "AG-2pistol"
    if (reformattedProducts.hasOwnProperty(productKey)) {

      // get hyphen permutations of key string for the $or query
      /* e.g.:
        'p1650'
        'p-1650'
        'p1-650'
        'p16-50'
        'p165-0'
      */
      var productKeyPermutations = [];

      var splitKey = productKey.split('-');
      var numHyphens = splitKey.length - 1;
      var baseKey = splitKey.join('');

      productKeyPermutations.push(baseKey);

      if (baseKey.length > 1) {
        for (var i = 1; i < baseKey.length; i++) {
          productKeyPermutations.push(baseKey.slice(0, i) + '-' + baseKey.slice(i));

          // NOTE: there should be a more elegant way to handle an arbitrary
          // number of hyphens, but I haven't seen any cases with more than 3.
          if (baseKey.length > 2 && numHyphens === 2) {
            for (var j = i + 1; j < baseKey.length; j++) {
              productKeyPermutations.push(baseKey.slice(0, i) + '-' + baseKey.slice(i, j) + '-' + baseKey.slice(j));

              if (baseKey.length > 3 && numHyphens >= 3) {
                for (var k = j + 1; k < baseKey.length; k++) {
                  productKeyPermutations.push(baseKey.slice(0, i) + '-' + baseKey.slice(i, j) + '-' + baseKey.slice(j, k) + '-' + baseKey.slice(k));
                }
              }
            }
          }
        }
      }


      // insert permutations into the $or query
      /*
        orQuery format:
        [
          { mcbid: 'p1650' },
          { mcbid: 'p-1650' },
          { mcbid: 'p1-650' },
          ...
        ]
      */
      var orQuery = [];
      productKeyPermutations.forEach(function(perm) {
        orQuery.push({ mcbid: { $regex: perm, $options: 'i' } });
      });


      // insert the query into the parallel callObj
      callObj[productKey] = function(asyncCallback) {
        Case
          .findOne(
            {
              $or: orQuery
            })
          .select({ mcbid: 1, csCartProductIDs: 1 })
          .exec(function(findCaseErr, foundCase) {
            if (findCaseErr) {
              console.log('findCaseErr for ', orQuery, ': ', findCaseErr);
              asyncCallback('Error finding case: ' + findCaseErr, null);
            } else {
              if (foundCase) {

                // Set the case's csCartProductIDs according to reformattedProducts.
                // We need to wrangle some of the data to match the DB schema.
                var newProductData = reformattedProducts[productKey];


                /*

                newProductData format:
                 { caseAndFoam:
                   [ { serverKey: 'EUR_5', productId: '25' },
                     { serverKey: 'USA_1', productId: '533' },
                     { serverKey: 'EUR_1', productId: '25' } ],
                  base:
                   [ { serverKey: 'EUR_5', productId: '13' },
                     { serverKey: 'USA_1', productId: '13' },
                     { serverKey: 'EUR_1', productId: '13' } ],
                  foamOnly:
                   [ { serverKey: 'EUR_5', productId: '26' },
                     { serverKey: 'USA_1', productId: '534' },
                     { serverKey: 'EUR_1', productId: '26' } ] }

                */

                Cart.find().exec(function(err, carts) {
                  if (err) console.warn(err);
                  carts = carts || [];

                  foundCase.csCartProductIDs = getBlankCsCartProductIdsObj(foundCase, carts);

                  Object.keys(newProductData).forEach(function(caseType) {  // caseType = 'base', 'foamOnly', or 'caseAndFoam'
                    if (newProductData.hasOwnProperty(caseType)) {
                      if (newProductData[caseType] && newProductData[caseType].length > 0) {

                        newProductData[caseType].forEach(function(product) {  // product = { serverKey: 'EUR_5', productId: '25' }

                          var slicedServerKey = product.serverKey.slice(0,3);  // e.g. "USA"
                          var serverNumber = product.serverKey.slice(-1);  // e.g. "1"

                          foundCase.csCartProductIDs[slicedServerKey][caseType][serverNumber] =
                            parseInt(product.productId);

                        });

                      }
                    }
                  });

                  // Mongoose-ism for "Mixed" fields:
                  foundCase.markModified('csCartProductIDs');

                  // save the case
                  foundCase.save(function(saveErr, savedCase) {
                    if (saveErr) {
                      console.log('SAVE ERR: ', saveErr);
                      asyncCallback(saveErr, null);
                    } else {
                      console.log('Successfully saved csCartProductIDs for ', foundCase.mcbid);
                      asyncCallback(null, savedCase);
                    }
                  });
                });
              } else {
                // case not found
                asyncCallback(null, null);
              }
            }
          });
      };

    }
  });


  // run these DB queries in parallel, also calling save() in parallel
  async.parallel(callObj, function(asyncErr, asyncResults) {
    if (asyncErr) {
      console.log('asyncErr: ', asyncErr);
      return res.status(500);
    } else {
      console.log('async success');
      // return to client so we can display a success alert.
      // TODO...
      return res.json({
        msg: 'Successfully saved!'
      })
    }
  });

};

var getServerInstanceStores = function (callback) {
  var callObj = {};

  Cart.find()
    .populate('stores')
    .exec(function(err, carts) {
      if (err) console.warn(err);

      carts.forEach(function(cart) {
        var url = new URL(cart.baseURL);
        url.username = cart.apiUser;
        url.password = cart.apiKey;
        url.pathname = '/api/stores/';
        // NOTE: change this param if we ever have more than 100 stores
        url.search = '?items_per_page=100';
        var instanceKey = cart.region;

        callObj[instanceKey] = function(cscartInstanceCallback) {
          request({
            // staging/development only permit un-signed/self-signed cert
            rejectUnauthorized: (process.env.NODE_ENV === 'production'),
            method: 'GET',
            url: url.toString()
          }, function(e, r, body) {
            var data;
            r = r || { statusCode: 500, request: { uri: url.toString() } };

            if (e || r.statusCode > 300) {
              console.warn('Error fetching a list of stores from CS-Cart.', e||instanceKey, r.statusCode);
              console.error(r.request.uri);
              cscartInstanceCallback();
              return;
            }

            try {
              data = JSON.parse(body);
            } catch (e) {
              console.warn('Error processing response from CS-Cart.', e||instanceKey, body);
              cscartInstanceCallback();
              return;
            }

            data.cart = cart;
            cscartInstanceCallback(null, data);
          });
        }
      });

      async.parallel(callObj, function(error, results) {
        if (error) return callback(error);

        var cartServerInstances = Object.keys(results);

        cartServerInstances.forEach(function(serverInstance) {
          if (!results[serverInstance] || !Array.isArray(results[serverInstance].stores)) {
            delete results[serverInstance];
          }
          else {
            var mcbStores = results[serverInstance].cart.stores;

            results[serverInstance].stores.forEach(function(csCartStore, csIdx) {
              mcbStores.forEach(function(mcbStore) {
                if (mcbStore.csCartServerInstance === serverInstance && mcbStore.csCartID) {
                  if (parseInt(csCartStore.company_id) === parseInt(mcbStore.csCartID)) {
                    if (!results[serverInstance].stores[csIdx]['mcb_ezIDs']) {
                      results[serverInstance].stores[csIdx]['mcb_ezIDs'] = [];
                    }
                    results[serverInstance].stores[csIdx]['mcb_ezIDs'].push(mcbStore.ezID);
                  }
                }
              });
            });
          }
        });

        callback(null, results, carts);
      });
    });
};

var getBlankCsCartProductIdsObj = function (theCase, serverInstances) {
  // Returns a blank object IF the case does not already have the proper fields.
  var csCartProductIDs = Object.assign({}, theCase.csCartProductIDs);

  if (!csCartProductIDs) {
    csCartProductIDs = {};
  }

  serverInstances.forEach(function(cart) {
    var name = cart.region;
    if (!csCartProductIDs[name]) {
      csCartProductIDs[name] = {
        'base': {},
        'foamOnly': {},
        'caseAndFoam': {}
      }
    }

    // set defaults in case of corrupted data
    Object.keys(csCartProductIDs[name]).forEach(function(caseTypeKey) {
      if (csCartProductIDs[name].hasOwnProperty(caseTypeKey)) {
        Object.keys(csCartProductIDs[name][caseTypeKey]).forEach(function(storeKey) {
          if (csCartProductIDs[name][caseTypeKey].hasOwnProperty(storeKey)) {
            if (!csCartProductIDs[name][caseTypeKey][storeKey] || isNaN(csCartProductIDs[name][caseTypeKey][storeKey])) {
              csCartProductIDs[name][caseTypeKey][storeKey] = 1;
            }
          }
        });
      }
    });
  });

  return csCartProductIDs;
};
