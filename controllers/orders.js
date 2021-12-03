var Q = require('q');
var mongoose = require('mongoose');
var User = require('../models/User');
var Case = require('../models/Case');
var CaseCategory = require('../models/CaseCategory');
var Store = require('../models/Store');
var Design = require('../models/Design');
var InCaseShape = require('../models/InCaseShape');
var Revision = require('../models/Revision');
var StringHelpers = require('../helpers/strings');
var validator = require('validator');
var _ = require('lodash');
var Promise = require('bluebird');


exports.getIndex = function (req, res) {
  res.render('designer/index', {});
};

exports.getIndexJSON = function (req, res, next) {
  var findQuery = {
    owners: req.user,
    softDelete: null
  };

  // Pagination. See this source for insight:
  // https://scalegrid.io/blog/fast-paging-with-mongodb/
  if (req.query.lastDesignId) {
    findQuery['_id'] = {
      $lt: mongoose.Types.ObjectId(req.query.lastDesignId)
    };
  }
  var pageSize = req.query.pageSize ? parseInt(req.query.pageSize) : 50;

  Design.find(findQuery)
    .populate({
      path: 'currentRev',
      select: 'name snapshot store case fileID createdAt',
      populate: [{
        path: 'store',
        model: 'Store',
        select: 'ezID name'
      }, {
        path: 'case',
        model: 'Case',
        select: 'mcbid name'
      }]
    })
    .populate({
      path: 'revisions',
      select: 'name snapshot store case fileID createdAt',
      populate: [{
        path: 'store',
        model: 'Store',
        select: 'ezID name'
      }, {
        path: 'case',
        model: 'Case',
        select: 'mcbid name'
      }]
    })
    .sort({ updatedAt: -1 })
    .limit(pageSize)
    .exec(function (err, designs) {
      if (err) return next(err);
      res.json(designs);
    });
};

exports.searchDesignJSON = function (req, res, next) {
  var findQuery = {
    owners: req.user._id,
    softDelete: null,
    $text: {
      $search: req.query.searchQuery
    }
  };

  Design.find(findQuery)
    .populate({
      path: 'currentRev',
      select: 'snapshot store case fileID',
      populate: [{
        path: 'store',
        model: 'Store',
        select: 'ezID name'
      }, {
        path: 'case',
        model: 'Case',
        select: 'mcbid name'
      }]
    })
    .populate({
      path: 'revisions',
      select: 'name snapshot fileID createdAt'
    })
    .sort('-updatedAt')
    .exec(function (err, designs) {
      if (err) return next(err);
      res.json(designs);
    });
};

exports.getLang = function (req, res) {
  var lang = 'en';
  if (req.query.hasOwnProperty('lang')) {
    lang = req.query.lang;
  } else if (req.query.hasOwnProperty('l')) {
    lang = req.query.l;
  }

  // input sanitization
  lang = lang.replace(/[\W_]+/g, '');
  // language files are 2 character alpha only.

  var langFile = require('../i18n/en.json');

  try {
    langFile = require('../i18n/' + lang + '.json');
  } catch (e) {
    /* langfile not valid, default to en.json */
  }

  res.json(langFile);
};

exports.getNew = function (req, res, next) {
  var store = false,
    kase = false,
    designID = false,
    design = null,
    lang = req.user && req.user.appSettings && req.user.appSettings.language ? req.user.appSettings.language : 'en',
    unit = req.user && req.user.appSettings && req.user.appSettings.units ? req.user.appSettings.units : 'inches',
    betaMode = false,
    storeParam = false;

  var done = function (setRevision) {
    var langFile = require('../i18n/en.json');

    try {
      langFile = require('../i18n/' + lang + '.json');
    } catch (e) {
      /* langfile not valid, default to en.json */
    }

    var renderView = function () {
      function _render(_obj, skip) {
        if (skip) {// running the caseCategory fetch parallel with another call before this function
          res.render('orders/new', _obj);
        } else {
          CaseCategory.find({}, '-_id').then(function (categories) {
            _obj.caseCategories = categories.map(function (item) {
              return item.name;
            });
            let user = req.user;
            let query = user.isAdmin() ? {} : { _id: user.store };
            let page = req.query.page || req.cookies.page;
            let search = req.query.search || req.cookies.search;

            var opts = {
              page: Math.max(1, parseInt(page || 1)),
              limit: Math.max(10, parseInt(req.query.size || 10)),
              lean: true,
            };

            if (!!search) {
              query["$or"] = [{ region: RegExp("" + search, "i") }];
            }

              res.render('orders/new', _obj);
            
          }, function (err) {
            return err;
          });
        }
      }
      if (setRevision) {
        if (setRevision.isCustom) {
          _render({
            store: store ? store : setRevision.store,
            kase: {
              "name": "custom",
              "_id": "custom_id",
              "length": setRevision.customSize.length,
              "width": setRevision.customSize.width,
              "lowerLength": setRevision.customSize.lowerLength,
              "lowerWidth": setRevision.customSize.lowerWidth,
              "baseDepth": setRevision.customSize.baseDepth,
              "totalDepth": setRevision.customSize.totalDepth,
              "borderWidth": 1,
              "cornerRadius": setRevision.customSize.cornerRadius,
              "inCaseShapes": [],
              "isCustom": true
            },
            design: design,
            langFile: langFile,
            lang: lang,
            unit: setRevision.unit,
            betaMode: betaMode
          });
        } else {
          _render({
            store: store ? store : setRevision.store,
            kase: setRevision.case,
            design: design,
            langFile: langFile,
            lang: lang,
            unit: setRevision.unit,
            betaMode: betaMode
          });
        }

        return;
      }
      if (kase) {
        if (kase === 'custom') {
          _render({
            store: store,
            kase: {
              "name": "custom",
              "length": parseFloat(req.query.ul) || parseFloat(req.query.length) || 5,
              "width": parseFloat(req.query.uw) || parseFloat(req.query.width) || 5,
              "lowerLength": parseFloat(req.query.ll) || parseFloat(req.query.lower_length) || 5,
              "lowerWidth": parseFloat(req.query.lw) || parseFloat(req.query.lower_width) || 5,
              "baseDepth": parseFloat(req.query.d) || parseFloat(req.query.depth) || 5,
              "totalDepth": parseFloat(req.query.d) || parseFloat(req.query.depth) || 5,
              "borderWidth": 1,
              "cornerRadius": parseFloat(req.query.cr) || parseFloat(req.query.corner_radius) || 0,
              "inCaseShapes": [],
              "isCustom": true
            },
            design: design,
            langFile: langFile,
            lang: lang,
            unit: unit,
            betaMode: betaMode
          });
          return;
        }
        var promises = [
          Case.findOne({ mcbid: kase.toLowerCase() }).populate('category inCaseShapes parts').then(function (theCase) {
            return theCase;
          }, function (err) {
            return err;
          }),
          CaseCategory.find({}, '-_id').then(function (categories) {
            return categories.map(function (item) {
              return item.name;
            });
          }, function (err) {
            return err;
          })
        ];
        Promise.all(promises).then(function (_res) {

          var _case = _res[0];
          var caseCategories = _res[1];

          _render({
            store: store,
            kase: _case,
            design: design,
            langFile: langFile,
            lang: lang,
            unit: unit,
            betaMode: betaMode,
            caseCategories: caseCategories
          }, true)
        });
      } else {
        _render({
          store: store,
          kase: (design && design.currentRev && design.currentRev.case) ? design.currentRev.case : null,
          design: design,
          langFile: langFile,
          lang: lang,
          unit: unit,
          betaMode: betaMode
        });
      }
    };

    var storeQuery = { ezID: store };
    if (store) {
      if (mongoose.Types.ObjectId.isValid(store)) {
        storeQuery = { _id: store };
      }
      else if (typeof store === 'object') {
        //storeQuery = { _id: store._id };
        renderView();
        return;
      }

      Store.findOne(storeQuery, function (err, foundStore) {
        if (err) return next(err);
        if (foundStore) {
          store = foundStore;
        }
        renderView();
      });
    } else {
      renderView();
    }
  };

  if (req.query.hasOwnProperty('store') && !!req.query.store) {
    storeParam = req.query.store;
  }
  else if (req.query.hasOwnProperty('sid') && !!req.query.sid) {
    storeParam = req.query.sid;
  }

  if (req.query.hasOwnProperty('case') && !!req.query.case) {
    kase = req.query.case;
  }
  else if (req.query.hasOwnProperty('casetype') && !!req.query.casetype) {
    kase = req.query.casetype;
  }

  if (req.query.hasOwnProperty('lang') && !!req.query.lang) {
    lang = req.query.lang;
  }
  else if (req.query.hasOwnProperty('l') && !!req.query.l) {
    lang = req.query.l;
  }

  if (req.query.hasOwnProperty('unit') && !!req.query.unit) {
    if (req.query.unit.slice(0, 2) === "in") {
      unit = "inches";
    }
    if (req.query.unit.slice(0, 2) === "mm") {
      unit = "mm";
    }
  }

  // overwrite w/ user prefs
  lang = req.user && req.user.appSettings && req.user.appSettings.language ? req.user.appSettings.language : lang;
  unit = req.user && req.user.appSettings && req.user.appSettings.units ? req.user.appSettings.units : unit;

  if (req.query.hasOwnProperty('betamode')) {
    // NOTE: "betamode" is a bit harder to guess than "beta"
    betaMode = req.query.betamode ? req.query.betamode.toLowerCase() === 'true' : false;
  }

  if (req.query.hasOwnProperty('design') && !!req.query.design) {
    designID = req.query.design;

    Design
      .findOne({ uniqueID: designID })
      .populate({
        path: 'currentRev',
        populate: [{
          path: 'store',
          model: 'Store'
        }, {
          path: 'case',
          model: 'Case',
          populate: [{
            path: 'inCaseShapes',
            model: 'InCaseShape'
          }]
        }]
      })
      .populate({
        path: 'revisions',
        populate: [{
          path: 'case',
          model: 'Case',
          populate: [{
            path: 'inCaseShapes',
            model: 'InCaseShape'
          }]
        }]
      })
      .exec(function (err, foundDesign) {
        if (err) return next(err);
        if (!foundDesign) {
          done();
          return;
        } else {
          var doneSettingStore = function () {
            var belongsToCurrentUser = foundDesign.owners.some(function (owner) {
              if (!req.user) {
                return false;
              }
              return String(owner) === String(req.user._id);
            });

            if (req.query.hasOwnProperty('rev') && (belongsToCurrentUser || !foundDesign.isTemplate)) {
              for (var i = 0; i < foundDesign.revisions.length; i++) {
                if (req.query.rev === foundDesign.revisions[i].fileID) {

                  // populate the Store object in the new current revision
                  foundDesign.revisions[i].store = foundDesign.currentRev.store;

                  // set the new currentRev
                  foundDesign.currentRev = foundDesign.revisions[i];
                  foundDesign.save();

                  break;
                }
              }
            }

            if (!foundDesign.shareable) {
              if (belongsToCurrentUser || (req.user && (req.user.isAdmin() || req.user.isAffiliate() || req.user.isRep() || req.user.isExporter()))) {
                design = foundDesign;
                done(foundDesign.currentRev);
                return;
              } else if (foundDesign.isTemplate) {
                // for non-owners and non-admins opening up a template, only open a
                // single revision from the query param (fallback to currentRev).
                if (req.query.hasOwnProperty('rev')) {
                  for (var i = 0; i < foundDesign.revisions.length; i++) {
                    if (req.query.rev === foundDesign.revisions[i].fileID) {

                      // populate the Store object in the new current revision
                      foundDesign.revisions[i].store = foundDesign.currentRev.store;

                      // set the new currentRev
                      foundDesign.currentRev = foundDesign.revisions[i];

                      break;
                    }
                  }
                }
                // remove all other revisions
                foundDesign.revisions = [foundDesign.currentRev];

                if (req.user) {
                  createTemplateCopy(foundDesign, req.user, function (err, clonedDesign) {
                    if (err) return next(err);
                    if (!clonedDesign) {
                      return res.status(404).render('404design', { title: "Sorry, we could not copy that template." });
                    }
                    design = clonedDesign;
                    var langParam = lang ? '&l=' + lang : '';
                    res.redirect('/app?design=' + clonedDesign.uniqueID + langParam);
                    return;
                  });
                } else {
                  // user is not signed in, so only send the relevant shape data from this template
                  design = JSON.parse(JSON.stringify(foundDesign));

                  // we access this field on the frontend to set the new design's "basedOnTemplate"
                  // field without displaying the rev's original fileID.
                  design.currentRev.fileIDForTemplate = design.currentRev.fileID;

                  delete design._id;
                  delete design.name;
                  delete design.revisions;
                  delete design.owners;
                  delete design.chatID;
                  delete design.uniqueID;
                  delete design.locked;
                  delete design.shareable;
                  delete design.updatedAt;
                  delete design.createdAt;

                  delete design.currentRev._id;
                  delete design.currentRev.fileID;
                  delete design.currentRev.updatedAt;
                  delete design.currentRev.createdAt;

                  done();
                  return;
                }
              } else {
                return res.status(404).render('404design', { title: "Sorry, page not found" });
              }
            } else {
              design = foundDesign;
              done(foundDesign.currentRev);
              return;
            }
          };

          if (foundDesign.currentRev && foundDesign.currentRev.store) {
            store = foundDesign.currentRev.store;
            doneSettingStore();
          } else if (storeParam) {
            req.user.getStore(storeParam, function (e, s) {
              store = s;
              if (!store) store = '149';
              foundDesign.currentRev.store = store;
              foundDesign.currentRev.save(function () {
                doneSettingStore();
              });
            });
          } else {
            store = req.user.currentStore();
            foundDesign.currentRev.store = store;
            foundDesign.currentRev.save(function () {
              doneSettingStore();
            });
          }
        }
      });
  } else {
    if (storeParam) {
      if (req.user) {
        req.user.getStore(storeParam, function (e, s) {
          store = s;
          if (!store) store = '149';
          done();
        });
      } else {
        store = storeParam;
        done();
      }
    } else {
      if (!req.user) {
        store = '149';
      } else {
        store = req.user.currentStore();
      }
      done();
    }
  }
};

exports.getDesignLockJSON = function (req, res, next) {
  if (req.params.hasOwnProperty('id') && !!req.params.id && mongoose.Types.ObjectId.isValid(req.params.id)) {
    Design.findOne({
      _id: req.params.id
    }, 'locked', function (err, foundDesign) {
      if (err) return next(err);
      if (!foundDesign) {
        return res.status(404).json({ msg: 'That design cannot be found', err: err });
      }
      res.json(foundDesign);
    });
  }
  else {
    res.status(400).json({ msg: 'That design cannot be found', err: "invalid id!" });
  }
};

exports.getRevisionByMongoID = function (req, res, next) {
  if (req.params.hasOwnProperty('id') && !!req.params.id && mongoose.Types.ObjectId.isValid(req.params.id)) {
    Revision.findById(req.params.id).populate({
      path: 'case',
      populate: {
        path: 'inCaseShapes'
      }
    }).exec(function (err, foundRevision) {
      if (err) return next(err);
      if (!foundRevision) {
        return res.status(404).json({ msg: 'That revision cannot be found', err: err });
      }

      return res.json(foundRevision);
    });
  } else {
    res.status(400).json({ msg: 'That revision cannot be found', err: "invalid id!" });
  }
};

exports.getDesignJSON = function (req, res, next) {
  var fileID = req.params.id;
  var designCopy;

  Revision.findOne({
    fileID: fileID
  }, function (err, foundRev) {
    if (err) return next(err);
    if (!foundRev) {
      return res.status(404).json({ msg: 'That revision cannot be found', err: 'Document not found for fileID: ' + fileID });
    }

    var user = req.user;

    var params = {
      revisions: foundRev,
    };

    if (!user.isAdmin() && !user.isExporter()) {
      // for regular users, ensure the user owns the design
      params.owners = user.id;
    }

    Design.findOne(params)
      .populate({
        path: 'currentRev',
        populate: {
          path: 'case'
        }
      })
      .populate({
        path: 'revisions',
        populate: {
          path: 'case'
        }
      })
      .exec(function (err, foundDesign) {
        if (err) return next(err);

        if (!foundDesign) {
          return res.status(404).json({ msg: 'That design cannot be found!', err: { queryWas: params } });
        }

        res.status(200).json(foundDesign);
      });
  });
};

exports.deleteDesignJSON = function (req, res, next) {
  Design.remove({ _id: req.params.id }, function (err) {
    if (err) return next(err);
    res.json({ status: 'OK' });
  });
};

exports.deleteDesignRevisionJSON = function (req, res, next) {
  Design.findOne({
    _id: req.params.design_id
  })
    .exec(function (err, design) {
      if (err) return next(err);
      if (!design) {
        return res.status(404).json({ msg: 'That design cannot be found', err: err });
      }

      var revisions = design.revisions.filter(rev => rev.toString() !== req.params.revision_id);
      var currentRev = revisions[0];

      Revision.remove({
        _id: req.params.revision_id
      }, function (err) {
        if (err) return next(err);

        design.revisions = revisions;
        design.currentRev = currentRev;

        design.save(function (err) {
          if (err) return next(err);
          res.json({
            status: 'OK'
          });
        });
      });
    });
};

exports.putDesignUpdateJSON = function (req, res, next) {
  Design.findOne({
    _id: req.params.id
  })
    .populate('currentRev')
    .exec(function (err, design) {
      if (err) return next(err);
      if (!design) {
        return res.status(404).json({ msg: 'That design is not available' });
      }
      var designChanged = false;
      if (req.body.hasOwnProperty('softDelete')) {
        if (req.body.softDelete === 'true') {
          design.softDelete = new Date();
        } else {
          design.softDelete = null;
        }

        design.save(function (err) {
          if (err) return next(err);
          return res.json({ 'status': 'OK' });
        });
      } else if (req.body.hasOwnProperty('store')) {

      } else if (req.body.hasOwnProperty('name')) {
        design.name = req.body.name;
        if (req.body.hasOwnProperty('shareable')) {
          design.shareable = req.body.shareable;
        }
        design.save(function (err) {
          if (err) return next(err);
          Design.findOne({
            _id: design._id
          })
            .populate('currentRev')
            .populate('revisions')
            .populate('inCaseShapes')
            .exec(function (err, design) {
              if (err) return next(err);
              if (!design) {
                return res.status(404).json({ msg: 'That design is not available' });
              }
              return res.json(design);
            });
        });
      } else if (req.body.hasOwnProperty('currentRev')) {
        Revision.findOne({
          _id: req.body.currentRev
        }, function (err, rev) {
          if (err) return next(err);
          if (!rev) {
            return res.status(404).json({ msg: 'That design is not available' });
          }
          design.currentRev = rev;
          design.save(function (err) {
            if (err) return next(err);

            Design.findOne({
              _id: design._id
            })
              .populate({
                path: 'currentRev',
                populate: [{
                  path: 'case',
                  populate: [{
                    path: 'inCaseShapes'
                  }]
                }]
              })
              .populate({
                path: 'revisions',
                populate: [{
                  path: 'case'
                }]
              })
              .populate('inCaseShapes')
              .exec(function (err, design) {
                if (err) return next(err);
                if (!design) {
                  return res.status(404).json({ msg: 'That design is not available' });
                }
                return res.json(design);
              });
          });
        });
      } else if (req.body.hasOwnProperty('isTemplate')) {
        if (req.user.isAdmin()) {
          design.isTemplate = req.body.isTemplate;
          design.save(function (err) {
            if (err) return next(err);
            return res.json({ 'status': 'OK' });
          });
        } else {
          return res.status(403).json({ msf: 'You must be an admin to do this.' });
        }

      } else {
        return res.status(406).json({ msg: 'Missing call parameters' });
      }

      var done = function () {
        if (designChanged) {
          design.save(function (err) {
            if (err) return next(err);
            return res.json({ msg: 'Design updated' });
          });
        } else {
          return res.json({ msg: 'Nothing updated' });
        }
      };
    });
};

exports.getUserDesignsJSON = function (req, res, next) {
  var requester = req.user;
  var email = req.params.email;
  var query =
    requester.isAdmin() ?
      User.findOne({ email: email }) :
      User.findOne({ email: email, store: requester.store });

  query.exec(function (err, user) {
    if (err) return next(err);
    if (!user) {
      res.status(404).json({ msg: 'Cannot find that user', err: err });
      return;
    }
    Design.find({
      owners: user
    })
      .populate({
        path: 'currentRev',
        select: 'snapshot store case fileID',
        populate: [{
          path: 'store',
          model: 'Store',
          select: 'ezID'
        }, {
          path: 'case',
          model: 'Case',
          select: 'mcbid name'
        }]
      }).exec(function (err, designs) {
        if (err) return next(err);
        if (!designs) {
          res.status(404).json({ msg: 'Cannot find designs for that user.', err: err });
          return;
        }
        res.json(designs);
      });
  });
};

exports.putDesignLockJSON = function (req, res, next) {
  Design.findOne({
    _id: req.params.id
  }, function (err, foundDesign) {
    if (err) return next(err);
    if (!foundDesign) {
      return res.status(404).json({ msg: 'That design cannot be locked at this time', err: err });
    }
    var belongsToCurrentUser = foundDesign.owners.some(function (owner) {
      if (!req.user) {
        return false;
      }
      return String(owner) === String(req.user._id);
    });

    if (!req.user.isAdmin() && !belongsToCurrentUser) {
      return res.status(401).json({ msg: 'You are not authorized to lock this file.' });
    }

    foundDesign.locked = true;
    foundDesign.save(function (err, savedDesign) {
      if (err) return next(err);
      if (!savedDesign) {
        return res.status(404).json({ msg: 'That design cannot be locked at this time', err: err });
      }
      return res.json(savedDesign);
    });
  });
};

exports.putDesignSoftLockJSON = function (req, res, next) {
  Design.findOne({
    _id: req.params.id
  }, function (err, foundDesign) {
    if (err) return next(err);
    if (!foundDesign) {
      return res.status(404).json({ msg: 'That design cannot be locked at this time', err: err });
    }
    var belongsToCurrentUser = foundDesign.owners.some(function (owner) {
      if (!req.user) {
        return false;
      }
      return String(owner) === String(req.user._id);
    });

    if (!req.user.isAdmin() && !belongsToCurrentUser) {
      return res.status(401).json({ msg: 'You are not authorized to lock this file.' });
    }

    foundDesign.softLocked = req.body.shouldLock;
    foundDesign.save(function (err, savedDesign) {
      if (err) return next(err);
      if (!savedDesign) {
        return res.status(404).json({ msg: 'That design cannot be locked at this time', err: err });
      }
      return res.json(savedDesign);
    });
  });
};

var multipleLock = function (req, res, foundDesigns, shouldLock, options, next) {
  // hacky way to track when all designs have been saved
  var numDesigns = foundDesigns.length, currentNumSaved = 0, errors = [];
  var finishedSaving = function () {
    if (errors.length) {
      res.status(500).json({ msg: 'There was an error while saving those designs', err: errors });
      return next(errors[errors.length - 1]);
    }
    return res.json({ message: 'Successfully saved designs' });
  };

  foundDesigns.forEach(function (design) {
    if (options.softLock) {
      design.softLocked = shouldLock;
    } else if (options.hardLock) {
      design.locked = shouldLock;
    }

    design.save(function (err, savedDesign) {
      currentNumSaved += 1;
      if (err) {
        errors.push(err);
      }

      if (currentNumSaved === numDesigns) {
        return finishedSaving();
      }
    });
  });
};

exports.putDesignSoftLockMultipleJSON = function (req, res, next) {
  var designIds = req.body.designIds.split(' ').map(function (id) {
    return mongoose.Types.ObjectId(id.replace(/"/g, ''));
  });
  var shouldLock = req.body.shouldLock;

  Design.find({
    _id: { $in: designIds }
  }, function (err, foundDesigns) {
    if (err) return next(err);
    if (!foundDesigns) {
      return res.status(404).json({ msg: 'That design cannot be locked at this time', err: err });
    }
    // TODO: validations to ensure user is admin or owns these designs
    multipleLock(req, res, foundDesigns, shouldLock, { softLock: true }, next);
  });
};

exports.putDesignLockMultipleJSON = function (req, res, next) {
  var designIds = req.body.designIds.split(' ').map(function (id) {
    return mongoose.Types.ObjectId(id.replace(/"/g, ''));
  });
  var shouldLock = true;

  Design.find({
    _id: { $in: designIds }
  }, function (err, foundDesigns) {
    if (err) return next(err);
    if (!foundDesigns) {
      return res.status(404).json({ msg: 'That design cannot be locked at this time', err: err });
    }
    // TODO: validations to ensure user is admin or owns these designs
    multipleLock(req, res, foundDesigns, shouldLock, { hardLock: true }, next);
  });
};

exports.putUpdateAdminPdfData = function (req, res, next) {
  if (!req.body.hasOwnProperty('pdfData')) {
    res.status(400).json({ msg: 'pdfData parameter missing' });
    return;
  }
  var data;

  try {
    data = JSON.parse(req.body.pdfData);
  } catch (e) {
    res.status(400).json({ msg: 'JSON string expected.', err: e });
    return;
  }

  var promises = [];
  data.forEach(function (item) {
    promises.push(
      Revision.findOne({
        fileID: item.fileID
      }).then(function (doc) {
        var index;
        if (doc.adminExportPdfData) {
          index = doc.adminExportPdfData.findIndex(function (d) {
            return d.fileUuid === item.fileUuid;
          });
        }

        delete item.fileID;


        if (doc.adminExportPdfData && index >= 0) {
          doc.adminExportPdfData.set(index, item);
        } else if (doc.adminExportPdfData) {
          doc.adminExportPdfData.push(item);
        } else {
          doc.adminExportPdfData = [item];
        }

        return doc.save().then(function (e) {
          return Promise.resolve(doc);
        }, function (err) {
          return Promise.reject({ msg: 'could not save pdfdata', err: err });
        });
      }, function (err) {
        return Promise.reject({ msg: 'could not update the pdfdata', err: err });
      })
    );
  });

  Promise.all(promises).then(function (results) {
    res.status(200).json({ status: 'ok' });
  }, function (err) {
    res.status(404);
    next(err);
  });
};

exports.putUpdateAdminPdfDataAndOrPublicDesignData = (req, res, next) => {

  if (!req.body.revisionID) {
    res.status(400).json({ msg: 'revisionID parameter missing' });
    return;
  }

  let adminExportPdfData;
  let publicDesignData;



  try {
    if (req.body.adminExportPdfData) {
      adminExportPdfData = JSON.parse(req.body.adminExportPdfData);
    }
    if (req.body.publicDesignData) {
      publicDesignData = JSON.parse(req.body.publicDesignData);
    }
  } catch (e) {
    res.status(400).json({ msg: 'JSON string expected.', err: e });
    return;
  }


  if (adminExportPdfData === null && publicDesignData === null) {
    res.status(400).json({ msg: 'one of adminExportPdfData or publicDesignData required' });
    return;
  }

  let adminPdfDataAndOrPublicDesignData = async () => {

    let revision = await Revision.findById(req.body.revisionID);
    if (!revision) return Promise.reject({ statusCode: 404, message: 'cannot find revision with provided _id.' });

    if (adminExportPdfData) {
      revision.adminExportPdfData = adminExportPdfData;
    }


    if (publicDesignData) {

      if (!revision.publicDesign) {
        revision.publicDesign = {};
      }

      if (typeof publicDesignData.isCandidate !== "undefined") {
        revision.publicDesign.isCandidate = publicDesignData.isCandidate;
      }
      if (typeof publicDesignData.caseType !== "undefined") {
        revision.publicDesign.caseType = publicDesignData.caseType;
      }
      if (typeof publicDesignData.caseTypeOther !== "undefined") {
        revision.publicDesign.caseTypeOther = publicDesignData.caseTypeOther;
      }
    }

    let saved = await revision.save();
    if (!saved) return Promise.reject({ statusCode: 404, message: 'could not save to revision' });

    let design = await Design.findOne({ revisions: saved }).populate('currentRev')
      .populate('revisions')
      .populate('inCaseShapes');

    if (!design) return Promise.reject({ statusCode: 500, message: 'cannot find design ' });

    return design;
  }

  adminPdfDataAndOrPublicDesignData().then(r => {
    res.status(200).json({
      status: 'OK',
      data: r
    });
  }).catch(err => {
    console.error(err)
    next(err);
  });

}


exports.putDesignSnapshotJSON = function (req, res, next) {
  Design.findOne({
    _id: req.params.id
  })
    .populate('currentRev')
    .populate('revisions')
    .populate('inCaseShapes')
    .exec(function (err, sentDesign) {
      if (err) return next(err);
      if (!sentDesign) {
        return res.status(404).json({ msg: 'That design is not available', err: err });
      }
      //
      function findRevision(design) {
        Revision.findOne({
          _id: design.currentRev
        }, function (err, rev) {
          if (err) return next(err);

          if (!rev) {
            return res.status(404).json({ msg: 'That revision is not available', err: err });
          }

          if (req.body.hasOwnProperty('name')) {
            rev.name = req.body.name;
          }

          if (req.body.hasOwnProperty('data')) {
            rev.data = req.body.data;
          }

          if (req.body.hasOwnProperty('layers')) {
            rev.layers = req.body.layers;
          }

          if (req.body.hasOwnProperty('unit')) {
            rev.unit = req.body.unit;
          }

          if (req.body.hasOwnProperty('unitToPixelRatio')) {
            rev.unitToPixelRatio = req.body.unitToPixelRatio;
          }

          if (req.body.hasOwnProperty('snapshot')) {
            rev.snapshot = req.body.snapshot;
          }

          if (req.body.hasOwnProperty('customSize')) {
            rev.customSize = req.body.customSize;
            rev.isCustom = true;
            rev.case = undefined;
          }

          if (req.body.hasOwnProperty('case') && validator.isMongoId(req.body.case)) {
            rev.isCustom = false;
            rev.case = req.body.case;
            delete rev.customSize;
          }

          if (rev.oldData !== null) {
            rev.oldData = null;
          }

          function done() {
            var canSave = true;
            if (!design.shareable) {
              var belongsToCurrentUser = design.owners.some(function (owner) {
                if (!req.user) {
                  return false;
                }
                return String(owner) === String(req.user._id);
              });
              if (!belongsToCurrentUser) {
                canSave = false;
              }
            }

            if ((req.user && req.user.isAdmin()) && !canSave && !req.body.override) {
              return res.status(401).json({ msg: 'That design is not available', err: 'Unauthorized' });
            } else if ((req.user && req.user.isAffiliate()) && !canSave) {
              // only allow affiliate to save another user's file if the design belongs to their store
              if (String(req.user.store) !== String(design.currentRev.store)) {
                return res.status(401).json({ msg: 'That design is not available', err: 'Unauthorized' });
              }
            } else if ((!req.user || !req.user.isAdmin()) && !canSave) {
              return res.status(401).json({ msg: 'That design is not available', err: 'Unauthorized' });
            }

            var revData = rev.toObject();
            delete revData.updatedAt;

            if (!Number.isNaN(revData.__v)) {
              revData.__v++;
            } else {
              revData.__v = 1;
            }

            // Why not rev.save() here? When mongoose is using Version Keys (the default), and the database connection
            // is in a high latency environment (i.e. Europe -> North America), a race condition occurs when multiple
            // requests are handled within the DB latency window. Each mongodb save() call gets submitted with
            // the same Version Key, creating a Version Key out of sequence error like the following:
            //
            // VersionError: No matching document found for id "xxxx" version xx modifiedPaths "data, layers, snapshot, updatedAt"
            //
            // Due to the application design, this handler gets called frequently, every time a change is made to a design. Spotlighting the problem...
            rev.update(revData, function (err) {
              // low priority error, log but continue processing...
              if (err) rollbar.error(err, req, { level: "warning" });

              Design.findOne({
                _id: req.params.id
              })
                .populate({
                  path: 'currentRev',
                  populate: [{
                    path: 'case'
                  }]
                })
                .populate({
                  path: 'revisions',
                  populate: [{
                    path: 'case'
                  }]
                })
                .populate('inCaseShapes')
                .exec(function (err, foundDesign) {
                  if (err) return next(err);
                  if (!foundDesign) {
                    return res.status(404).json({ msg: 'That design cannot be found at this time.', err: err });
                  }
                  return res.json(foundDesign);
                });
            });
          }

          if (req.body.hasOwnProperty('case') && !rev.isCustom) {
            Case.findById(req.body.case, function (err, kase) {
              if (err) return next(err);
              if (!kase) {
                res.status(404).json({ msg: 'That case cannot be found at this time.', err: err });
              }
              rev.isCustom = false;
              rev.case = kase;
              done();
            });
          } else {
            done();
          }
        });
      }

      // if the current revision trying to be saved
      // is not the same as the current revsion in the db
      if (req.body.hasOwnProperty('currentRev') &&
        !sentDesign.currentRev._id.equals(req.body.currentRev)) {
        sentDesign.currentRev = req.body.currentRev;
        sentDesign.save(function (err, foundDesign) {
          if (err) return next(err);
          findRevision(foundDesign);
        });
      } else {
        findRevision(sentDesign);
      }
      ////
    });
};

exports.postDesignCloneJSON = function (req, res, next) {
  Design.findOne({
    _id: req.params.id
  }, function (err, foundDesign) {
    if (err) return next(err);
    if (!foundDesign) {
      return res.status(404).json({ msg: 'Cannot find that design at this time.' });
    }
    var currentRevisionIndex = 0;
    foundDesign._id = mongoose.Types.ObjectId();
    foundDesign.name = foundDesign.name + ' (copy)';
    foundDesign.isNew = true;
    foundDesign.locked = false;
    foundDesign.softLocked = false;
    foundDesign.createdAt = new Date();
    var done = function () {
      getUniqueID(function (rand) {
        foundDesign.uniqueID = rand;
        foundDesign.save(function (err, savedDesign) {
          if (err) return next(err);
          if (!savedDesign) {
            return res.status(404).json({ msg: 'Unable to clone your design at this time.' });
          }
          return res.json({ uniqueID: foundDesign.uniqueID });
        });
      });
    };

    var nextRevsions = function (r) {
      var newId;
      Revision.findOne({
        _id: r
      }, function (err, foundRev) {
        if (err) return next(err);
        if (!foundRev) {
          return res.status(404).json({ msg: 'Cannot find that design at this time.' });
        }
        if (foundRev._id.equals(foundDesign.currentRev)) {
          newId = mongoose.Types.ObjectId();
          foundDesign.currentRev = newId;
          foundRev._id = newId;
        } else {
          newId = mongoose.Types.ObjectId();
          foundRev._id = newId;
        }

        foundRev.isNew = true;

        foundRev.save(function (err, savedRev) {
          if (err) return next(err);
          if (!savedRev) {
            return res.status(404).json({ msg: 'Cannot find that design at this time.' });
          }
          foundDesign.revisions[currentRevisionIndex] = savedRev._id;
          if (currentRevisionIndex + 1 >= foundDesign.revisions.length) {
            done();
          } else {
            currentRevisionIndex += 1;
            nextRevsions(foundDesign.revisions[currentRevisionIndex]);
          }
        });
      });
    };
    nextRevsions(foundDesign.revisions[currentRevisionIndex]);
    var getUniqueID = function (callback) {
      var rand = StringHelpers.randomNumChars(10);
      Design.findOne({ uniqueID: rand }, function (err, design) {
        if (err) return next(err);
        if (!design) {
          callback(rand);
        } else {
          getUniqueID(callback);
        }
      });
    };
  });
};

exports.postDesignCloneTemplateJSON = function (req, res, next) {
  Design.findOne({
    _id: req.params.id
  })
    .exec(function (err, design) {
      if (err) return next(err);
      if (!design) {
        return res.status(404).json({ msg: 'That design is not available' });
      } else {
        createTemplateCopy(design, req.user, function (err, clonedDesign) {
          if (err) return next(err);
          if (!clonedDesign) {
            return res.status(404).json({ msg: "Sorry, we could not copy that template." });
          }
          return res.json({ uniqueID: clonedDesign.uniqueID });
        });
      }
    });
};

exports.postDesignSnapshotJSON = function (req, res, next) {

  Design.findOne({
    _id: req.params.id
  })
    .populate('currentRev')
    .populate('revisions')
    .populate('inCaseShapes')
    .exec(function (err, design) {
      if (err) return next(err);
      if (!design) {
        return res.status(401).json({ msg: 'That design is not available' });
      }
      var designChanged = false;
      Revision.findOne({
        _id: design.currentRev
      })
        .populate('store')
        .populate('case')
        .exec(function (err, rev) {
          if (err) return next(err);
          var newRev = new Revision({
            name: 'design' + (parseInt(design.revisions.length) + 1),
            data: rev.data,
            unitToPixelRatio: rev.unitToPixelRatio,
            store: rev.store,
            case: rev.case,
            customSize: rev.customSize,
            isCustom: rev.isCustom
          });
          newRev.save(function (err) {
            if (err) return next(err);
            design.revisions.push(newRev);
            design.currentRev = newRev;
            design.save(function (err) {
              if (err) return next(err);
              Design.findOne({
                _id: design._id
              })
                .populate({
                  path: 'currentRev',
                  populate: [{
                    path: 'case'
                  }]
                })
                .populate({
                  path: 'revisions',
                  populate: [{
                    path: 'case'
                  }]
                })
                .populate('inCaseShapes')
                .exec(function (err, design) {
                  if (err) return next(err);
                  return res.json(design);
                });

            });
          });
        });
    });
};

exports.postDesignJSON = function (req, res, next) {

  var design = new Design({
    owners: [req.user],
    name: _.escape(req.body.name)
  });

  if (req.body.basedOnTemplate) design.basedOnTemplate = req.body.basedOnTemplate;

  var revision = new Revision({
    data: req.body.data,
    unitToPixelRatio: parseFloat(req.body.unitToPixelRatio),
    name: 'design1',
    unit: req.body.unit,
    snapshot: req.body.snapshot
  });

  var getUniqueID = function (callback) {
    var rand = StringHelpers.randomNumChars(10);
    Design.findOne({ uniqueID: rand }, function (err, design) {
      if (err) return next(err);
      if (!design) {
        callback(rand);
      } else {
        getUniqueID(callback);
      }
    });
  };
  getUniqueID(function (rand) {
    var designErr = 'Your design could not be saved at this time due to a network error.';
    design.uniqueID = rand;
    design.chatID = StringHelpers.randomNumChars(50);
    var storeFind = req.body.store ? { _id: req.body.store } : { _id: req.user.store };
    var caseFind = { _id: req.body.case };
    if (!req.body.hasOwnProperty('case')) {
      caseFind = { mcbid: 'pz4' };
    }
    Store.findOne(storeFind, { name: 1 }, function (err, store) {
      if (err) return next(err);
      if (!store) {
        return res.status(500).json({ msg: designErr, errMsg: 'Store not found.', err: err });
      }
      revision.store = store;

      var saveRevision = function saveRevision(err) {
        if (err) return next(err);
        design.revisions.push(revision);
        design.currentRev = revision;
        design.save(function (err) {
          if (err) return next(err);
          Design.findOne({
            _id: design._id
          })
            .populate({
              path: 'currentRev',
              populate: [{
                path: 'case'
              }]
            })
            .populate({
              path: 'revisions',
              populate: [{
                path: 'case'
              }]
            })
            .populate('inCaseShapes')
            .exec(function (err, design) {
              if (err) return next(err);
              return res.json(design);
            });
        });
      };

      if (req.body.case === 'custom') {
        var customSize;
        revision.isCustom = true;
        customSize = JSON.parse(req.body.custom_size);
        customSize.totalDepth = customSize.depth;
        customSize.baseDepth = customSize.depth;
        revision.customSize = customSize;
        revision.save(saveRevision);
      } else {
        Case.findOne(caseFind, function (err, kase) {
          if (err) return next(err);
          if (!kase) {
            return res.status(500).json({ msg: designErr, errMsg: 'Case not found.', err: err });
          }
          revision.case = kase;
          revision.save(saveRevision);
        });
      }
    });
  });
};


var createTemplateCopy = function (design, userObj, templateCallback) {

  design._id = mongoose.Types.ObjectId();
  design.name = design.name + ' (template)';
  design.isNew = true;
  design.locked = false;
  design.isTemplate = false;
  design.owners = [userObj._id];

  if (design.currentRev) design.basedOnTemplate = design.currentRev.fileID;

  // NOTE: there seems to be a Mongoose bug preventing these dates
  // from updating automatically via the "timestamps" schema flag.
  var now = new Date();
  design.createdAt = now;
  design.updatedAt = now;

  var currentRevisionIndex = 0;

  var done = function () {
    getUniqueID(function (rand) {
      design.uniqueID = rand;
      design.save(function (err, savedDesign) {
        if (err || !savedDesign) {
          return templateCallback(new Error('Unable to make a copied design from this template.'), null);
        }
        return templateCallback(null, savedDesign);
      });
    });
  };

  var nextRevsions = function (r, idx) {
    var newId;
    Revision.findOne({
      _id: r
    }, function (err, foundRev) {
      if (err) return next(err);
      if (!foundRev) {
        return templateCallback('Cannot find the design revisions.', null);
      }

      newId = mongoose.Types.ObjectId();
      foundRev._id = newId;
      if (idx === 0) {
        design.currentRev = newId;
      }

      foundRev.isNew = true;

      foundRev.save(function (err, savedRev) {
        if (err) return next(err);

        design.revisions[currentRevisionIndex] = savedRev._id;
        if (currentRevisionIndex + 1 >= design.revisions.length) {
          done();
        } else {
          currentRevisionIndex += 1;
          nextRevsions(design.revisions[currentRevisionIndex]);
        }
      });
    });
  };
  nextRevsions(design.revisions[currentRevisionIndex], currentRevisionIndex);
  var getUniqueID = function (callback) {
    var rand = StringHelpers.randomNumChars(10);
    Design.findOne({ uniqueID: rand }, function (err, design) {
      if (err) return next(err);
      if (!design) {
        callback(rand);
      } else {
        getUniqueID(callback);
      }
    });
  };
};
