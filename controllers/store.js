const async = require('async');
const Store = require('../models/Store');
const Case = require('../models/Case');
const Cart = require("../models/Cart");
const Price = require('../models/Price');
const Part = require('../models/Part');
const CaseOption = require('../models/CaseOption');
const Variant = require('../models/Variant');

let defaultURL = 'http://mycasebuilder.com/';

/**
 * GET /
 * List of stores
 */
exports.index = function(req, res, next) {
  let user = req.user;
  let query = user.isAdmin() ? {} : { _id: user.store };
  let page = req.query.page || req.cookies.page;
  let search = req.query.search || req.cookies.search;

  var opts = {
    sort: { ezID: 1 },
    //populate: 'cases',
    page: Math.max(1, parseInt(page || 1)),
    limit: Math.max(10, parseInt(req.query.size || 10)),
    lean: true
  };

  if (!!search) {
    query['$or'] = [
      { 'name': RegExp(''+search, 'i') },
      { 'ezID': RegExp(''+search, 'i') }
    ];
  }

  Store.paginate(query, opts, function(err, stores) {
    if (err) return next(err);
    stores.search = search || '';
    stores.isAdmin = user.isAdmin();

    if (stores.page) {
      res.cookie('page', stores.page, {path: '/stores'});
    }

    res.render('stores/index', stores);
  });
  /*
  query
  .sort({ezID:1})
  .populate({
    path: 'prices',
    populate: {
      path: 'part',
      model: 'Part'
    }
  })
  .populate('cases')
  .exec(function(err, stores){
    res.render('stores/index', {
      stores: stores,
      isAdmin: user.isAdmin()
    });
  });
  */
};

exports.deleteOptions = function(req, res) {
  CaseOption.findOne({
    _id: req.params.optionId
  })
  .populate('choices')
  .exec(function(err, foundOption) {
    if(!foundOption) {
      res.json({
        status: 'BAD',
        message: 'Option cannot be found'
      });
    }
    var removedChoices = 0;
    function finished(empty) {
      if(!empty) {
        removedChoices++;
      }
      if(removedChoices === foundOption.choices.length) {
        foundOption.remove(function() {
         res.json({
            status: 'OK',
            message: 'Option has been removed'
          });
        });
      }
    }

    if(foundOption.choices.length) {
      foundOption.choices.forEach(function(choice) {
        choice.remove(function() {
          finished();
        });
      })
    } else {
      finished(true);
    }
  });
};

exports.getOptions = function(req, res) {
  var user = req.user;
  var query = user.isAdmin() ?
    Price.findOne({_id: req.params.optionId}) :
    Price.findOne({_id: req.params.optionId, store: user.store});

  query
  .populate({
    path: 'options',
    populate: {
      path: 'choices',
      model: 'Variant'
    }
  })
  .exec(function(err, foundPrice) {
    if(!foundPrice) {
      res.render('404', { url: req.url });
      return;
    }
    res.json({
      status: 'OK',
      message: 'Options found',
      price: foundPrice
    });
  });
};

exports.newOptions = function(req, res) {
  var user = req.user;
  var query =
    user.isAdmin() ?
      Price.findOne({_id: req.params.priceId}) :
      Price.findOne({_id: req.params.priceId, store: user.store});

  query.exec(function(err, foundPrice){
    if(!foundPrice) {
      res.json({
        status: 'BAD',
        message: 'Unable to find price by that id.'
      });
      return;
    }
    var caseOption = new CaseOption({
      name: req.body['option-name'],
      optionType: req.body['option-type'],
      help: req.body['help-text'],
      active: req.body['option-active']
    });
    caseOption.save(function(err, newCaseOption) {
      if(!newCaseOption) {
        res.json({
          status: 'BAD',
          message: 'Database error, unable to save option at this time. Try again shortly'
        });
        return;
      }

      foundPrice.options.push(newCaseOption);
      foundPrice.save(function(err, savedPrice) {
        if(!savedPrice) {
          res.json({
            status: 'BAD',
            message: 'Database error, unable to save price at this time. Try again shortly'
          });
          return;
        }
        Price.findOne({
          _id: savedPrice._id
        })
        .populate('options')
        .exec(function(err, updatedPrice){
          CaseOption.findOne({
            _id: newCaseOption._id
          }, function(err, foundOption) {
            res.json({
              status: 'OK',
              message: 'Option saved successfully',
              option: foundOption,
              price: updatedPrice
            });
          });
        });
      });
      return;
    });
  })
};

exports.newVariants = function(req, res) {

  CaseOption.findOne({
    _id: req.params.id
  }, function(err, foundOption) {
    if(!foundOption) {
      res.json({
        status: 'BAD',
        message: 'Option not found'
      });
      return
    }
    var called = 0;
    var variantFinished = function() {
      if(++called === req.body['variants-name'].length) {
        foundOption.save(function() {
          CaseOption.findOne({
            _id: foundOption._id
          })
          .populate('choices')
          .exec(function(err, populatedFoundOption) {
            res.json({
              status: 'OK',
              message: 'Variant created successfully',
              option: populatedFoundOption
            });
            return;
          });
        });
      }
    };
    req.body['variants-name'].forEach(function(variant, i) {
      var newVariant = Variant({
        name: req.body['variants-name'][i],
        modifier: req.body['variants-modifier'][i]/100,
        modifierType: req.body['variants-modifier-type'][i],
        active: req.body['variants-active'][i] === 'true'
      });
      foundOption.choices.push(newVariant);
      newVariant.save(function(err, savedVariant) {
        variantFinished();
      });
    });
  });
};

exports.getPartsIndex = function(req, res) {
  if (!req.user.isAdmin() && !req.params.id === req.user.store) {
    res.render('404', { url: req.url });
    return;
  }
  Store.findOne({
    _id: req.params.id
  })
  .populate({
    path: 'prices',
    populate: {
      path: 'part',
      model: 'Part',
      sort: 'name',
      populate: {
        path: 'case',
        model: 'Case',
        sort: 'name',
      }
    }
  })
  .populate({
    path: 'cases',
    populate: {
      path: 'parts',
      model: 'Part',
      sort: 'name'
    }
  })
  .exec(function(err, foundStore) {
    if(!foundStore) {
      res.render('404', { url: req.url });
      return;
    }

    res.render('stores/parts/index', {
      store: foundStore,
      options: CaseOption.schema.path('optionType').enumValues,
      isAdmin: req.user.isAdmin()
    });
  });
};

exports.getNew = function(req, res) {
  Case.find(function(err, cases){
    Store.find()
      .exec(function(err, stores){
        Cart.find()
          .exec(function(err, carts) {
            res.render('stores/edit',{
              action: 'new',
              store: new Store({}),
              cases: cases,
              stores: stores,
              csCartServerInstances: carts.map(function(cart) { return cart.region; })
            });
          });
      });
  });
};

exports.delete = function(req, res) {
  Store.findOne({_id: req.params.id}, function(err, store) {
    if(!store) {
      res.json({
        status: 'BAD',
        message: 'Store not found'
      });
    } else {
      store.remove(function() {
        res.json({
          status: 'OK'
        });
      });
    }
  });
};

exports.deletePart = function(req, res) {
  var user = req.user;
  var query =
    user.isAdmin() ?
      Price.findOne({_id: req.params.priceId}) :
      Price.findOne({_id: req.params.priceId, store: user.store });

  query
    .populate({
      path: 'options',
      populate: {
        path: 'choices',
        model: 'Variant'
      }
    })
    .exec(function(err, foundPrice) {
    if(!foundPrice) {
      res.json({
        status: 'BAD',
        message: 'Price not found'
      });
      return;
    }

    // remove all findprices choices if it has any.
  });
};

exports.updatePrice = function(req, res) {
  var user = req.user;
  var query =
    user.isAdmin() ?
      Price.findOne({_id: req.params.priceId}) :
      Price.findOne({_id: req.params.priceId, store: user.store});

  query.exec(function(err, foundPrice) {
    if(!foundPrice) {
      res.json({
        status: 'BAD',
        message: 'Price not found'
      });
    } else {
      var acceptableVals = ['value','available']
      var firstProp = Object.getOwnPropertyNames(req.body)[0];
      if(acceptableVals.indexOf(firstProp) !== -1) {
        foundPrice[firstProp] = req.body[firstProp];
        foundPrice.save(function(err, savedPrice){
          res.json({
            status: 'OK',
            message: 'Price updated',
            price: savedPrice
          })
        });
      } else {
        res.json({
          status: 'BAD',
          message: 'Unacceptable property update'
        });
      }

    }
  });
}

exports.addPart = function(req, res) {
  var user = req.user;
  var query =
    user.isAdmin() ?
      Store.findOne({_id: req.params.id}) :
      Store.findOne({_id: user.store});

  query.exec(function(err, foundStore) {
    if(!foundStore) {
      res.json({
        status: 'BAD',
        message: 'Store not found.'
      });
      return;
    } else {
      Part.findOne({
        _id: req.params.partId
      }).populate('case').exec(function(err, foundPart) {
        if(!foundPart) {
          res.json({
            status: 'BAD',
            message: 'Part not found'
          });
        } else {
          var hasPrice = false;
          Price.findOne({
            store: foundStore,
            part: foundPart
          }, function(err, foundPrice) {
            if(foundPrice) {
              hasPrice = true;
              res.json({
                status: 'BAD',
                message: 'Part already exists in your store.'
              });
              return;
            } else {
              var newPrice = Price({
                store: foundStore,
                part: foundPart,
                value: 0
              });

              newPrice.save(function(err, savedPrice) {
                foundStore.prices.push(savedPrice);
                foundStore.save(function() {
                  foundPart.prices.push(savedPrice);
                  foundPart.save(function() {
                    res.json({
                      status: 'OK',
                      message: 'Part was added.',
                      price: newPrice,
                      part: foundPart
                    });
                  });
                });
                return;
              });
            }
          });
        }
      });
    }
  });
};


/**
 * POST new store
 * Create a new Store.
 * 1. Set Store name
 * 2. Take list of Cases and save Case list.
 * 3. Get Parts from Cases and make Part list
 * 4. For each Part create a Price and tie to Store and Part.
 * 5. Save each Part.
 * 6. Save Store with many parts.
 **/
exports.postNew = function(req, res) {
  req.assert('name', 'Name cannot be blank').notEmpty();
  var errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/stores/new');
  }
  // 1. Set Store name
  var name = req.body.name;
  var ezID = req.body.ezID;
  var cases = req.body.cases;
  var checkoutURL = req.body.checkoutURL;
  var logoURL = req.body.logoURL;
  var allDone = false;
  var newStore = new Store({
    name: name,
    ezID: ezID,
    checkoutURL: checkoutURL || defaultURL,
    logoURL: logoURL || defaultURL,
    adminEmail: req.body.adminEmail,
    shouldEmailAdmin: req.body.shouldEmailAdmin
  });

  if(!cases) {
    newStore.save(function(err, savedStore){
      if (err) {
        req.flash('success', { msg: 'Error when adding this store.' });
        res.redirect('/stores');
      } else {
        req.flash('success', { msg: 'Your store has been saved!' });
        res.redirect('/stores');
      }
    });
    return;
  }

  // turn cases into array if needed
  if(!(cases instanceof Array)) {
    cases = [cases];
  }

  // 6. Save Store with many parts.
  var saveStore = function() {
    newStore.save(function() {
      req.flash('success', { msg: 'Your store has been saved!' });
      res.redirect('/stores');
    });
  };
  //3. Get Parts from Cases and make Part list
  var maxCase = cases.length - 1;
  var currentCaseIdx = 0;
  var lastCase = false;
  var nextCase = function() {
    // if last case
    if(currentCaseIdx === maxCase) {
      lastCase = true;
    }
    var thisCase = cases[currentCaseIdx];
    Case.findOne({ _id: thisCase }, function(err, foundCase) {
      var partIdx = 0;
      var maxPart = foundCase.parts.length;
      var partList = [];
      if(!foundCase) {
        res.render('404', { url: req.url });
        return;
      }

      thisCase = foundCase;
      // 2. Take list of Cases and save Case list.
      newStore.cases.push(thisCase);
      var nextPart = function() {
        Part.findOne({
          _id: thisCase.parts[partIdx]
        }, function(err, foundPart) {
          var lastPart = false;
          var price;
          // 4. For each Part create a Price and tie to Store and Part.
          partIdx++;
          if(partIdx === maxPart) {
            lastPart = true;
          }
          if(foundPart) {
            price = new Price({
              value: 0,
              store: newStore,
              part: foundPart
            });
            foundPart.prices.push(price);
            newStore.prices.push(price);
            price.save(function(){
              // 5. Save each Part.
              foundPart.save(function(){
                if(!lastPart) {
                  nextPart();
                } else {
                  currentCaseIdx++;
                  if(lastCase) {
                    saveStore()
                  } else {
                    nextCase();
                  }
                }
              });
            });
          } else {
            if(!lastPart) {
              nextPart();
            } else {
              currentCaseIdx++;
              if(lastCase) {
                saveStore()
              } else {
                nextCase();
              }
            }
          }
        });
      };
      nextPart();
    });
  }
  nextCase();
};

exports.getEdit = function(req, res) {
  Store.findOne({
    _id: req.params.id
  })
  .populate({
    path: 'cases',
    select: '_id'
  })
  .exec(function(err, store){
    if(!store) {
      res.render('404', { url: req.url });
      return;
    }

    Case.find()
    .select({ _id: 1, selected: 1, name: 1, mcbid: 1 })
    .lean()
    .exec(function(err, cases){
      if(err){
        console.log('error', err);
      }
      cases = cases.map(function(c){
        var hasCaseSelected = store.cases.some(function(sc){
          return sc._id.equals(c._id)
        });
        if(hasCaseSelected){
          c.selected = 'selected';
        } else {
          c.selected = null;
        }
        return c;
      });

      Store.find()
        .exec(function(err, stores){
          Cart.find()
            .exec(function(err, carts) {
              res.render('stores/edit',{
                action: 'edit',
                store: store,
                cases: cases,
                stores: stores,
                csCartServerInstances: carts.map(function(cart) { return cart.region; })
              });
          });
        });
    });
  });
};

exports.postEdit = function(req, res) {
  req.assert('name', 'Name cannot be blank').notEmpty();
  var errors = req.validationErrors();

  if (errors) {
    req.flash('errors', errors);
    return res.redirect('/stores/new');
  }

  var name = req.body.name;
  Store.findOne({
    _id: req.params.id
  }, function(err, store){
    if(!store) {
      res.render('404', { url: req.url });
      return;
    }
    var name = req.body.name;
    var cases = req.body.cases;
    var checkoutURL = req.body.checkoutURL;
    var logoURL = req.body.logoURL;
    var hasCustomLogo = req.body.hasCustomLogo;
    var logoImg = req.body.logoImg;
    var logoImgWidth = req.body.logoImgWidth;
    var csCartServerInstance = req.body.csCartServerInstance;
    store.name = name;
    store.cases = cases;
    store.checkoutURL = checkoutURL || defaultURL;
    store.logoURL = logoURL || defaultURL;
    store.hasCustomLogo = hasCustomLogo || false;
    store.logoImg = logoImg || '';
    store.logoImgWidth = logoImgWidth || '60px';
    store.ezID = req.body.ezID;
    store.adminEmail = req.body.adminEmail;
    store.shouldEmailAdmin = req.body.shouldEmailAdmin;
    if (!Number.isNaN(parseInt(req.body.estDaysToShip))) {
      store.estDaysToShip = req.body.estDaysToShip;
    } else {
      delete store.estDaysToShip
    }
    store.isRegionalParent = (req.body.isRegionalParent === 'true') ? true : false;
    store.csCartID = req.body.csCartID;
    store.csCartServerInstance = csCartServerInstance;

    store.save(function(){
      req.flash('success', { msg: 'Your store has been edited!' });
      res.redirect('/stores');
    });
  });
};

exports.postCopyCases = function(req, res) {
  Store.findOne({_id: req.body.currentStore})
    .populate('cases')
    .populate({
      path: 'cases',
      populate: {
        path: 'parts',
        model: 'Part'
      }
    })
    .exec(function(currentStoreErr, currentStore) {
      if (currentStoreErr || !currentStore) {
        return res.send(500);
      }
      Store.findOne({_id: req.body.selectedStore})
        .populate('cases')
        .populate({
          path: 'cases',
          populate: {
            path: 'parts',
            model: 'Part',
            sort: 'name'
          }
        })
        .exec(function(selectedStoreErr, selectedStore) {
          if (selectedStoreErr || !selectedStore) {
            return res.send(500);
          }

          // first, delete all prices attached to the currentStore
          var partIds = [];
          if (currentStore.cases) {
            currentStore.cases.forEach(function(theCase) {
              if (theCase.parts) {
                theCase.parts.forEach(function(part) {
                  partIds.push(part._id);
                });
              }
            });
          }

          async.parallel(
            [
              function(removeParallelCallback) {
                Part.update(
                  {
                    _id: {
                      $in: partIds
                    }
                  },
                  {
                    $pull: {
                      prices: {
                        $in: currentStore.prices
                      }
                    }
                  },
                  { multi: true },
                  function(partErr, updatedParts) {
                    if (partErr) {
                      return res.send(500);
                    }
                    removeParallelCallback(null, updatedParts);
                  }
                );
              },
              function(removeParallelCallback) {
                Price.remove(
                  {
                    _id: {
                      $in: currentStore.prices
                    }
                  },
                  function(priceErr, updatedPrices) {
                    if (priceErr) {
                      return res.send(500);
                    }
                    removeParallelCallback(null, updatedPrices);
                  }
                )
              }
            ],
            function(parallelErr, parallelResults) {
              if (parallelErr) {
                return res.send(500);
              }
              // then, generate new prices from selectedStore

              // deep-copy
              var cases = JSON.parse(JSON.stringify(selectedStore.cases));

              // push all new prices into array
              var prices = [];
              var priceSaveFunctions = [];
              if (selectedStore.cases) {
                selectedStore.cases.forEach(function(theCase) {
                  if (theCase.parts) {
                    theCase.parts.forEach(function(part) {
                      var newPrice = Price({
                        store: currentStore,
                        part: part,
                        value: 0,
                        available: true
                      });

                      priceSaveFunctions.push(
                        function(saveSeriesCallback) {
                          newPrice.save(function(priceErr, savedPrice) {
                            if (!priceErr) {
                              prices.push(savedPrice);
                              part.prices.push(savedPrice);
                              part.save(function() {
                                saveSeriesCallback(null, savedPrice);
                              });
                            }
                          })
                        });
                    });
                  }
                });
              }

              async.series(
                priceSaveFunctions,
                // async docs: https://github.com/caolan/async/blob/v1.5.2/README.md#user-content-control-flow-1
                function(seriesErr, seriesResults){
                  if (seriesErr) {
                    return res.send(500);
                  }

                  currentStore.cases = cases;
                  currentStore.prices = prices;
                  currentStore.save(function(saveErr, updatedStore) {
                    if (saveErr) {
                      return res.send(500);
                    }
                    return res.send(200);
                  });
                });
            });
        });
    });
};

exports.getStoreCheckoutData = function(req, res) {
  Store.findOne({
    _id: req.params.storeId
  })
  .populate('csCartServer')
  .exec(function(err, store) {
    var data = store.toJSON();
    if (err) {
      res.send(500);
    } else if (!store) {
      res.send(404);
    } else {
      store['currency'] = '$';
      if (store['csCartServer']) {
        data['currency'] = store['csCartServer'].currency;
      }
      res.json(data);
    }
  });
};