var path = require('path');

var mongodb = require('mongodb');
var mongoose = require('mongoose');

var request = require('request');
var Store = require('../models/Store');
var Design = require('../models/Design');
var Revision = require('../models/Revision');

var Cart = require("../models/Cart");
var User = require("../models/User");
var cuid = require('cuid');
var _url = require('url');

var nodemailer = require('nodemailer');
var onFinished = require('on-finished');
var moment = require('moment-timezone');
var ObjectID = require('mongodb').ObjectID

//NOTE: process.env.SPARKPOST_API_KEY is referenced from inside this module.
var sparkPostTransport = require('nodemailer-sparkpost-transport');

var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));

const agenda = require('../lib/taskScheduler.js');

exports.create = function (req, res) {

  // cleanup uploaded files after the response closes, always...
  // indiscriminate of the response error and/or status code
  onFinished(res, function (err, res) {
    console.log('END '+res.req.path);
    var GridFSBucket = mongodb.GridFSBucket;
    var unlinkPromises = [];

    // clean up any uploaded files - in this handler, files are exclusively temporary
    if (res.req.files && res.req.files.length) {
      res.req.files.forEach(function (file) {
        var options = {bucketName: file.bucketName};
        var bucket = new GridFSBucket(Design.db.db, options);
        bucket.delete(file.id).then(function() {
          console.log(' - removed '+file.filename+' from GridFS');
        });
      });
    }
  });

  var storeQuery = { ezID: "149" };
  //default to USA

  if (!!req.user.store && mongoose.Types.ObjectId.isValid(req.user.store)) {
    storeQuery = { _id: req.user.store };
  }

  if (!!req.user.store && typeof req.user.store === "object" && !!req.user.store._id) {
    storeQuery = { _id: req.user.store._id };
  }

//promise all is all or nothing, which is what is wanted here. if any of the 4 API calls return nothing, return error
// the first 4 API calls, two to mongo and two to CS-Cart are to get the information Needed to build the API call found in createPublicDesign.
  Promise.all(
    [
      Store.findOne(storeQuery).populate('csCartServer').then(function (_res) {
        return _res;
      }),
      Design.findOne({_id: req.body.designID}).populate('currentRev').populate({
        path: 'currentRev',
        populate: {
          path: 'case'
        }
      }).then(function (_res) {
        return _res;
      }),
      Cart.findOne({region:'USA'}).then(function (_res) {
        return _res;
      })
    ]
  ).then(function (mongoRes) {
    var store = mongoRes[0];
    var design = mongoRes[1];

    var cart = mongoRes[2];
    cart = (store && store.csCartServer) ? store.csCartServer : cart;

    var userStoreKey = cart.region || 'USA';
    userStoreKey = (store && store.csCartServerInstance) ? store.csCartServerInstance : userStoreKey;

    var csCartID = store.csCartID || 1;
    var lang = req.params.lang || 'en';

    var caseAndFoamProductID = design.currentRev.case.csCartProductIDs[userStoreKey].caseAndFoam[csCartID];
    var foamOnlyProductID = design.currentRev.case.csCartProductIDs[userStoreKey].foamOnly[csCartID];

    return Promise.all(
      [
        new Promise(function (resolve, reject) {
          var url = new URL(cart.baseURL);
          url.username = cart.apiUser;
          url.password = cart.apiKey;
          url.pathname = '/api/products/' + foamOnlyProductID;
          url.search = '?lang_code=' + lang;

          request({
            // staging/development only permit un-signed/self-signed cert
            rejectUnauthorized: (process.env.NODE_ENV === 'production'),
            method: 'GET',
            url: url.toString()
          }, function (err, responseObj, body) {
            if (err) reject(err);
            var _body;
            try {
              _body = JSON.parse(body);
            } catch (e) {
              reject(e);
            }

            if (_body.status && _body.message) {
              reject(_body);
            } else {
              resolve(_body);
            }
          });
        }),
        new Promise(function (resolve, reject) {
          var url = new URL(cart.baseURL);
          url.username = cart.apiUser;
          url.password = cart.apiKey;
          url.pathname = '/api/products/' + caseAndFoamProductID;
          url.search = '?lang_code=' + lang;

          request({
            // staging/development only permit un-signed/self-signed cert
            rejectUnauthorized: (process.env.NODE_ENV === 'production'),
            method: 'GET',
            url: url.toString()
          }, function (err, responseObj, body) {
            if (err) reject(err);
            var _body;
            try {
              _body = JSON.parse(body);
            } catch (e) {
              reject(e);
            }

            if (_body.status && _body.message) {
              reject(_body);
            } else {
              resolve(_body);
            }
          });
        })
      ]
    ).then(function (csCartRes) {
      return {
        foamOnlyData: csCartRes[0],
        foamAndCaseData: csCartRes[1],
        cart: cart,
        store: store,
        design: design
      };
    }).catch(function (err) {
      rollbar.error(err, req);
      console.error(err);
      res.status(500).json({
        status: 'NOT OK',
        error: "Unable to get requested data"
      });
    });

  }).then(function (_res) {
    //should have all the data needed now to create the API call that will create the new item in CS-Cart.
    createPublicDesign(_res);
    return null;  // since we're chaining to a catch, this promise step needs a return value
  }).catch(function (err) {
    console.error(err, req);
    res.status(500).json({
      status: 'NOT OK',
      error: "Unable to get requested data"
    });
  });


  function createPublicDesign(apiResponses) {

    var fullDescription = (function () {
      //format full description here.
      return req.body.describeContents + "<br>" +
        "<br>" + req.body.designContents.join("<br>");
    })();

    var publicDesign = {
      status: "D",
      category_id: req.body.caseCategory.category_id,
      category_ids: "", //?? blank for now not used.
      tax_ids: 7, // 7 is the CS-Cart code for New Jersey, more about this field later like Vat or other states.
      exclude_features: 60, // 60 is 'Inner Dimensions (Cases Page)' in CS-Cart and it excludes that feature
      company_id: apiResponses.store && apiResponses.store.csCartID ? apiResponses.store.csCartID : 1, // not sure if company ID can ever be zero, so checking for value instead of short-circuit.
      design_id: apiResponses.design.uniqueID,
      mcb_id: "",
      price: apiResponses.foamAndCaseData.price,
      foam_only_price: apiResponses.foamOnlyData.price,
      full_description: fullDescription,
      image_links: "", // comma separated string,
      meta_description: req.body.nameOfFoam,
      meta_keywords: req.body.nameOfFoam,
      page_title: req.body.nameOfFoam,
      product: req.body.nameOfFoam,
      short_description: req.body.nameOfFoam,
      seo_name: req.body.nameOfFoam.toLowerCase().replace(/\s+/g, "-"),
      quantity: 1,
      product_code: "TCF-" + apiResponses.design.currentRev.case.mcbid + "-" + apiResponses.design.currentRev.fileID,
      product_template_id: apiResponses.design.currentRev.case.csCartProductIDs.USA.base['1']
    };

    var lang = req.params.lang || 'en';
    var folderPath = path.resolve('./public/uploads/') + '/';
    var filePromises = [];

    var cart = apiResponses.cart;

    if (req.files.length > 0) {

      req.files.forEach(function (item) {
        var imageName = item.filename; //cuid() + '.png';
        var url;

        var reqURL = new URL(req.href);
        reqURL.pathname = '/uploads/' + imageName;
        req.search = '';

        if(process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
          url = reqURL.toString();
        }  else {
          if (process.env.LOCALHOST_BASE_URL) {
            reqURL = new URL(process.env.LOCALHOST_BASE_URL);
            reqURL.pathname = '/uploads/' + imageName;
          }
          url = reqURL.toString();
        }

        filePromises.push(
          new Promise(function(resolve) {
            resolve({
              url: url,
              file: item
            });
          })
        );
      });

      Promise.all(filePromises).then(function (filesRes) {
        publicDesign.image_links = filesRes.map(function (item) {
          return item.url;
        }).join(", ");

        console.warn('Public Design request payload: ', publicDesign);

        var url = new URL(cart.baseURL);
        url.username = cart.apiUser;
        url.password = cart.apiKey;
        url.pathname = '/api/mcb_products';

        request({
          // staging/development only permit un-signed/self-signed cert
          rejectUnauthorized: (process.env.NODE_ENV === 'production'),
          method: 'POST',
          url: url.toString(),
          json: publicDesign
        }, function (err, responseObj, _body) {

          if (_body.status && _body.message) {
            res.status(500).json({
              status: 'NOT OK',
              error: "Unable to get requested data"
            });
          } else {

            _body = _body.replace(/"/g, ""); // malformed JSON response, striping quotes and treating as string.

            Design.update({_id: apiResponses.design._id}, {
              csCartPublicDesignId: _body,
              isTemplate: true
            }).then(function (mongooseDesignUpdateRes) {
              var url = new URL(cart.baseURL);
              url.pathname = '/mcbadminlogin.php';
              url.search = '?dispatch=products.update&product_id=' + _body;

              res.status(200).json({
                status: 'OK',
                result: {
                  "displayName": req.user.username,
                  "foamName": req.body.nameOfFoam,
                  "fileId": apiResponses.design.currentRev.fileID,
                  "userEmail": req.user.email,
                  "csCartProductId": _body,
                  "csCartProductIdLink": url.toString()
                }
              });

              var userTransporter = nodemailer.createTransport(
                sparkPostTransport({
                  "options": {
                    "open_tracking": true,
                    "click_tracking": true,
                    "transactional": true
                  },
                  "campaign_id": "public-design-submitted",
                  "metadata": {
                    "reason": "public-design-submitted"
                  },
                  "content": {
                    "template_id": "public-design-submitted"
                  }
                })
              );
              userTransporter.sendMail({
                "recipients":
                  [{
                    "address": {
                      "email": req.user.email
                    }
                  }
                  ]
              }).catch(function(err) {
                rollbar.error(err, req);
                console.error(err);
              });

              var adminTransporter = nodemailer.createTransport(
                sparkPostTransport({
                  "options": {
                    "open_tracking": true,
                    "click_tracking": true,
                    "transactional": true
                  },
                  "campaign_id": "public-design-admin",
                  "metadata": {
                    "reason": "public-design-admin"
                  },
                  "substitution_data": {
                    "displayName": req.user.username,
                    "foamName": req.body.nameOfFoam,
                    "fileId": apiResponses.design.currentRev.fileID,
                    "userEmail": req.user.email,
                    "csCartProductId": _body,
                    "csCartProductIdLink": url.toString()
                  },
                  "content": {
                    "template_id": "public-design-admin"
                  }
                })
              );
              adminTransporter.sendMail({
                "recipients":
                  [{
                    "address": {
                      "email": "steve@mycasebuilder.com" // eventually this will be stores admin emails.
                    }
                  }
                  ]
              }).catch(function(err) {
                rollbar.error(err, req);
                console.error(err);
              });
            });
          }
        });
      });
    }
  }

};


exports.updateCandidateStatus = function (req,res,next) {
  const defaultDelayTime = 14;

  let revisionID;

  if (!req.body.revisionID) {
    res.status(400).json({status:'NOT OK',error: 'fileID is missing'});
    return;
  } else {
    revisionID = req.body.revisionID;
  }



  let updateStatus = async () => {
    let revision = await Revision.findById(revisionID)
    if (!revision) return Promise.reject({statusCode: 404, message: 'cannot find revision with provided fileID.'});

    let store = await Store.findById(revision.store).populate('csCartServer')
    if (!store) return Promise.reject({statusCode: 404, message: 'cannot find revision with provided fileID.'});

    let design = await Design.findOne({revisions: revision._id}).populate('owners');
    if (!design) return Promise.reject({statusCode: 404, message: 'cannot find design with revision _id.'});

    let _date,job ;

    if (!revision.publicDesign.name.first && !req.body.firstName) {
      res.status(400).json({status:'NOT OK',error: 'firstName is missing, and there is no saved name.'});
      return;
    } else {
      revisionID = req.body.revisionID;
    }

    let agendaData = {
      name: {
        first: req.body.firstName || revision.publicDesign.name.first,
        last: req.body.lastName || revision.publicDesign.name.last || null
      },
      fileID: revision.fileID,
      revisionID: revision._id,
      owner: {
        id:design.owners[0]._id,
        email:design.owners[0].email
      },
      caseType: revision.publicDesign.caseTypeOther || revision.publicDesign.caseType || "",
      orderNumber: req.body.orderNumber ||  revision.publicDesign.orderNumber || ""

    }

    try {
      if (typeof req.body.isScheduled !== 'undefined') revision.publicDesign.isScheduled = req.body.isScheduled;
      if (typeof req.body.isSent !== 'undefined') revision.publicDesign.isSent = req.body.isSent;
      if (req.body.firstName) revision.publicDesign.name.first = req.body.firstName;
      if (req.body.lastName) revision.publicDesign.name.last = req.body.lastName;
      if(req.body.orderNumber) revision.publicDesign.orderNumber = req.body.orderNumber;
      if (typeof req.body.scheduledSendDate !== 'undefined') {
        if (req.body.scheduledSendDate === '') {
          revision.publicDesign.scheduledSendDate = null;
        } else {
          _date = new Date(req.body.scheduledSendDate);
          _date = `${_date.getMonth() + 1}/${_date.getDate()}/${_date.getFullYear()}`;
          _date = moment.tz(_date, 'l', store.csCartServer.timeZone || 'America/Los_Angeles');
          _date = _date.add(store.csCartServer.emailSendTime || 10, 'hours');
          _date = _date.tz('UTC');

          revision.publicDesign.scheduledSendDate = (new Date(_date));

          if(revision.publicDesign.agendaJobId) {
            await agenda.cancel({'_id':revision.publicDesign.agendaJobId});
          }
          job = await agenda.schedule(_date, 'sendPublicDesignEmail', agendaData);
          revision.publicDesign.agendaJobId = job.attrs._id;
        }
      }


    } catch (e) {
      return Promise.reject({statusCode: 500, message: e});
    }

    return revision.save().then(r => {
      return r;
    }, err => {
      agenda.cancel({'_id':job.attrs._id});
      return Promise.reject({statusCode: 500, message: err});
    });

  };

  updateStatus().then(r => {
    res.status(200).json({
      status: 'OK',
      data: r
    });
  }).catch(err => {
    console.error(err)
    next(err);
  });

};

// should pre-vet w/ passportConf.requireXAuthToken middleware
exports.updateCandidateStatusExternal = function (req,res,next) {
  // Status codes:
  // 200: everything is fine, returning processed.
  // 200: The incoming request is fine, but the revision is not a public design candidate.
  // 400: not going to process, somethings missing or wrong with the incoming data

  const defaultDelayTime = 14;

  let delay,fileID, fileUuid, firstName,lastName,orderNumber;

  if (!req.body.firstName) {
    res.status(400).json({status:'NOT OK',error: 'firstName is missing'});
    return;
  } else {
    firstName = req.body.firstName;
  }


  if (req.body.products && req.body.products.length === 0) {
    // not going to process, somethings missing or wrong with the data.
    res.status(400).json({status: 'NOT OK', message: 'no products, nothing to do.'});
    return;
  } else {

    try {
      fileID = req.body.products[0].fileID;
      fileUuid = req.body.products[0].fileUuid; // probably not needed
    } catch (e) {

    }
  }

  if (!req.body.orderId) {
    res.status(400).json({status:'NOT OK',error: 'orderNumber is missing'});
    return;
  } else {
    orderNumber = Number(req.body.orderId);
  }


  //not required items
  if (req.query.delay) {
    delay = Number(req.query.delay);
  } else {
    delay = defaultDelayTime;
  }
  if (req.body.lastName) {
    lastName = req.body.lastName;
  }

  let updateStatus = async () => {
    let error;
    let revision = await Revision.findOne({fileID:fileID});
    if (!revision) {
      res.status(404);
      error = new Error('Cannot find a revision with provided fileID.');
      return Promise.reject(error);
    }

    if (!revision.publicDesign || (revision.publicDesign && !revision.publicDesign.isCandidate) ) {
      // The incoming request is fine, but the revision is not a public design candidate.
      return {
        _custom:true,
        code:200,
        status:'OK',
        message: 'Request accepted, not a public design candidate, nothing to do.'
      };
    }

    let design = await Design.findOne({revisions: revision._id}).populate('owners');
    if (!design) {
      res.status(404);
      error = new Error('Cannot find design associated with revision._id');
      return Promise.reject(error);
    }

    let _date = new Date();
    _date = `${_date.getMonth() + 1}/${_date.getDate()}/${_date.getFullYear()}`;
    _date = moment.tz(_date, 'l', req.cart.timeZone || 'America/Los_Angeles');
    _date = _date.add(delay, 'days').add(req.cart.emailSendTime || 10, 'hours');
    _date = _date.tz('UTC');

    let job;

    let agendaData = {
      name: {
        first:firstName ,
        last:lastName || null
      },
      fileID:fileID,
      revisionID: revision._id,
      owner: {
        id:design.owners[0]._id,
        email:design.owners[0].email
      },
      caseType: revision.publicDesign ? revision.publicDesign.caseTypeOther || revision.publicDesign.caseType || "" : "",
      orderNumber: orderNumber
    }
    try {
      revision.publicDesign.isScheduled = true;
      revision.publicDesign.scheduledSendDate = _date;
      revision.publicDesign.name.first = firstName;
      revision.publicDesign.name.last = lastName || null;
      revision.publicDesign.orderNumber = orderNumber;

      if(revision.publicDesign.agendaJobId) {
        await agenda.cancel({'_id':revision.publicDesign.agendaJobId});
      }
      job = await agenda.schedule(_date, 'sendPublicDesignEmail', agendaData);
      revision.publicDesign.agendaJobId = job.attrs._id;
    } catch (err) {
      return Promise.reject(err);
    }

    return revision.save().then(r => {
      return r;
    }, err => {
      agenda.cancel({'_id':job.attrs._id});
      return Promise.reject(err);
    });

  };

  updateStatus().then(r => {
    if (r._custom) {
      res.status(r.code).json({
        status: r.status,
        message: r.message
      });
      return;
    }

    res.status(200).json({
      status: 'OK',
      data: r
    });
  }).catch(err => {
    console.error(err)
    next(err);
  });

};
