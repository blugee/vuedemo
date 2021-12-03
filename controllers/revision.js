"use strict";

const fs = require('fs');
const tmp = require('tmp');
const csv = require('fast-csv');

const User = require('../models/User');
const Case = require('../models/Case');
const Store = require('../models/Store');
const Design = require('../models/Design');
const Revision = require('../models/Revision');

const ObjectId = require('mongoose').Types.ObjectId;
const validator = require('validator');

/**
 * GET /
 * List of designs
 */
exports.index = function(req, res, next) {
  let query = {};
  let page = req.query.page || req.cookies.page;
  let smode = req.query.smode || req.cookies.smode;
  let search = req.query.search || req.cookies.search;
  let locked = req.query.locked || req.cookies.locked;
  let dateRange = req.query.dateRange || req.cookies.dateRange;
  let [start, end] = dateRange ? dateRange.split(' to ') : [false, false];

  let opts = {
    populate: [{
      path: 'case'
    }, {
      path: 'design'
    }],
    page: Math.max(1, parseInt(page || 1)),
    limit: Math.max(10, parseInt(req.query.size || 10)),
    sort: { "_id": -1 },
    allowDiskUse: true
  };

  if (!!search) {
    query['$or'] = [
      { '$text': { '$search': search } },
      { 'fileID': search }
    ];
  }

  if (!!locked) {
    query.locked = true;
  }

  if (start && end) {
    query['createdAt'] = {
      "$gte": new Date(start+'T00:00:00Z'),
      "$lt": new Date(end+'T23:59:59Z')
    };
  }

  var match = {
    '$or': [
        { email: RegExp(search, 'i') },
        { username: RegExp(search, 'i') }
      ]
  };

  if (!search) {
    match = { _id: false };
  }

  var pipeline = [
    { "$match": match },
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
        "revision.id": "$revision._id",
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
  ];

  var post = false;

  if (query.hasOwnProperty('locked')) {
    post = post || {};
    post.locked = query.locked;
  }

  if (query.hasOwnProperty('createdAt')) {
    post = post || {};
    post.createdAt = query.createdAt;
  }

  if (post) {
    pipeline.push({
      "$match": post
    });
  }

  var aggregate = User.aggregate(pipeline);

  if (smode == 2 && !!search) {
    User.aggregatePaginate(aggregate, opts, function(err, results) {
      if (err) return next(err);
      results.search = search || '';
      results.locked = locked ? 'on' : '';
      results.dateRange = dateRange || '';
      results.total = results.totalDocs;
      results.pages = results.totalPages;
      results.smode = smode || '';

      results.docs.forEach(function(d) {
        d.shapes = 0;
        d.uniqueDepths = 0;

        let _ud = new Set();
        let data = JSON.parse(d.data||'[]');

        data.forEach(function(s) {
          d.shapes++;
          _ud.add(s.d||0);
        });

        d.uniqueDepths = _ud.size;
      });

      if (results.page) {
        res.cookie('page', results.page, {path: '/designs'});
      }

      res.render('designs/index', results);
    });
  } else {
    Revision.paginate(query, opts, function(err, results) {
      if (err) return next(err);

      results.search = search || '';
      results.locked = locked ? 'on' : '';
      results.dateRange = dateRange || '';
      results.smode = smode || '';

      results.docs.forEach(function(d) {
        let _d = d.toJSON();

        d.shapes = 0;
        d.uniqueDepths = 0;

        let _ud = new Set();
        let data = JSON.parse(_d.data||'[]');

        data.forEach(function(s) {
          d.shapes++;
          _ud.add(s.d||0);
        });

        d.uniqueDepths = _ud.size;
      });

      if (results.page) {
        res.cookie('page', results.page, {path: '/designs'});
      }

      res.render('designs/index', results);
    });
  }
};

/**
 * GET /designs/:id
 * view design
 */
exports.getDesign = async (req, res, next) => {
  try{
    if (!req.params.id || !ObjectId.isValid(req.params.id)) {
      res.status(400);
      throw new Error('A valid id is required!');
    }

    let design = await Design.findOne({
      revisions: req.params.id
    }).populate([{
      path: 'revisions',
      model: 'Revision',
      populate: [{
        path: 'case',
        model: 'Case'
      }, {
        path: 'store',
        model: 'Store'
      }]
    }, 'owners']);

    if (!design) {
      res.status(404);
      throw new Error('Design not found!');
    }

    let revision = design.revisions.find(function(r) {
      return (''+r._id) === req.params.id;
    });

    res.render('designs/get', {
      title: 'Edit design',
      design,
      revision
    });

  } catch(error) {
    return next(error);
  }
};

/**
 * POST /designs/:id
 * view design
 */
exports.postDesign = async (req, res, next) => {
  try{
    if (!req.params.id || !ObjectId.isValid(req.params.id)) {
      res.status(400);
      throw new Error('A valid id is required!');
    }

    const design = await Design.findOne({
      revisions: req.params.id
    }).populate([{
      path: 'revisions',
      model: 'Revision',
      populate: [{
        path: 'case',
        model: 'Case'
      }, {
        path: 'store',
        model: 'Store'
      }]
    }, 'owners']);

    let revision = design.revisions.find(function(r) {
      return (''+r._id) === req.params.id;
    });

    let foundCase, foundStore, shouldSave = false, success = true, message = '';

    if (req.body['case']) {
      foundCase = await Case.findOne({mcbid: req.body['case']});
      if (foundCase) {
        revision['case'] = foundCase._id;
        shouldSave = true;
      } else {
        success = false;
        message = 'That Case could not be found. Save aborted!';
      }
    }

    if (req.body['store'] && success) {
      foundStore = await Store.findOne({ezID: req.body['store']});
      if (foundStore) {
        revision['store'] = foundStore._id;
        shouldSave = true;
      } else {
        success = false;
        message = 'That Store could not be found. Save aborted!';
      }
    }

    if (shouldSave && success) {
      revision = await revision.save();
      await revision.populate([{
        path: 'case',
        model: 'Case'
      }, {
        path: 'store',
        model: 'Store'
      }]).execPopulate();

      await design.save();
      message = "Design updated.";
    }

    res.render('designs/get', {
      title: 'Edit design',
      design,
      revision,
      success,
      message
    });

  } catch(error) {
    return next(error);
  }
};

/**
 * GET /designs/:id/transfer
 * Transfer designs between users
 */
exports.getTransfer = async (req, res, next) => {
  try{
    if (!req.params.id || !ObjectId.isValid(req.params.id)) {
      res.status(400);
      throw new Error('A valid id is required!');
    }

    const design = await Design.findOne({
      revisions: req.params.id
    }).populate([{
      path: 'revisions',
      model: 'Revision',
      populate: [{
        path: 'case',
        model: 'Case'
      }, {
        path: 'store',
        model: 'Store'
      }]
    }, 'owners']);

    const revision = design.revisions.find(function(r) {
      return (''+r._id) === req.params.id;
    });

    res.render('designs/transfer', {
      title: 'Transfer design',
      design,
      revision
    });

  } catch(error) {
    return next(error);
  }
};

/**
 * POST /designs/:id/transfer
 * Transfer a project to another user action
 **/
exports.postTransfer = async (req, res, next) => {
  try{
    if (!req.params.id || !ObjectId.isValid(req.params.id)) {
      res.status(400);
      throw new Error('A valid id is required!');
    }

    let design = await Design.findOne({
      revisions: req.params.id
    }).populate([{
      path: 'revisions',
      model: 'Revision',
      populate: [{
        path: 'case',
        model: 'Case'
      }, {
        path: 'store',
        model: 'Store'
      }]
    }, 'owners']);

    let revision = (design.revisions || []).find(function(r) {
      return (''+r._id) === req.params.id;
    });

    if(!revision) {
      res.render('designs/transfer', {
        title: 'Transfer design',
        success: false,
        message: 'Design not found! ('+req.params.id+')',
        design, revision
      });
      return;
    }

    const user = await User.findOne({
      email:{
        $regex: new RegExp('^'+req.body.email.trim().toLowerCase(), 'i')
      }
    });

    if (!user) {
      res.render('designs/transfer', {
        title: 'Transfer design',
        success: false,
        message: 'User not found! ('+req.body.email+')',
        design, revision
      });
      return;
    }

    design.owners = [user._id];
    design = await design.save();
    revision = await revision.save();

    await revision.populate([{
        path: 'case',
        model: 'Case'
      }, {
        path: 'store',
        model: 'Store'
      }]).execPopulate();

    design.owners = [user];
    res.render('designs/transfer', {
      title: 'Transfer design',
      success: true,
      message: 'Successfully transferred design ' + design.uniqueID + ' to ' + user.email,
      design, revision
    });

  } catch(error) {
    return next(error);
  }
};

/**
 * POST /designs/export
 * List of designs
 */
exports.postExport = function(req, res, next) {
  let query = {};
  let search = req.body.search||'';
  let smode = req.body.smode||"1";
  let locked = req.body.locked||'';
  let dateRange = req.body.dateRange||'';
  let [start, end] = !!dateRange ? dateRange.split(' to ') : [false, false];

  let opts = {
    populate: [{
      path: 'case',
      select: ['name', 'mcbid', 'width', 'length', 'totalDepth', 'baseDepth']
    }, {
      path: 'design'
    }]
  };

  if (!!search) {
    query['$or'] = [
      { '$text': { '$search': search } },
      { 'fileID': search }
    ];
  }

  if (!!locked) {
    query.locked = true;
  }

  if (start && end) {
    query['createdAt'] = {
      "$gte": new Date(start+'T00:00:00Z'),
      "$lt": new Date(end+'T23:59:59Z')
    };
  }


  var pipeline = [
    { "$match": {
      '$or': [
        { email: RegExp(search||'__UNDEFINED__', 'i') },
        { username: RegExp(search||'__UNDEFINED__', 'i') }
      ]
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
        "revision.id": "$revision._id",
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
  ];

  var post = false;

  if (query.hasOwnProperty('locked')) {
    post = post || {};
    post.locked = query.locked;
  }

  if (query.hasOwnProperty('createdAt')) {
    post = post || {};
    post.createdAt = query.createdAt;
  }

  if (post) {
    pipeline.push({
      "$match": post
    });
  }

  // create a temporary CSV file to write to
  tmp.file({prefix: 'revisions-export-', postfix: '.csv'}, function(err, path, fd, cleanup) {
    if (err) return next(err);

    const writeStream = fs.createWriteStream(path);

    const csvStream = csv.format({ headers: true }).on('end', function() {
      res.download(path, function (err) {
        if (err) return next(err);
        cleanup();
      });
    });

    csvStream.pipe(writeStream);
    req.setTimeout(300000); // 5 minutes

    let results;

    if (search && smode == 2) {
      results = User.aggregate(pipeline).allowDiskUse(true).cursor({ batchSize: 1000 }).exec();
    } else {
      results = Revision.find(query, null, opts).cursor();
    }

    results.on('data', function(doc) {
        try {
          doc.shapes = 0;
          doc.uniqueDepths = 0;

          let layers = (doc.layers || []).filter(l => l.isLid !== 'true');
          let _uniqueDepths = new Set();
          let _data = [];

          try {
            _data = JSON.parse(doc.data||'[]');
          } catch (ignore) {}

          _data.forEach(function(s) {
            doc.shapes++;
            _uniqueDepths.add(s.d||0);
          });

          doc.uniqueDepths = _uniqueDepths.size;

          let _case = doc.isCustom ? doc.customSize : doc.case;
          if (doc.isCustom) _case.name = "CUSTOM-FOAM-ONLY";
          doc.layers = doc.layers || [];

          let record = {
            'FileID'          : doc.fileID,
            'Case Name'       : _case.name || '',
            'Length'          : _case.length||'',
            'Width'           : _case.width||'',
            'Depth'           : _case.baseDepth||'',
            '# Shapes'        : doc.shapes,
            '# Unique Depths' : doc.uniqueDepths,
            '# Trays'         : layers.length,
            'Created'         : doc.createdAt,
            'Updated'         : doc.updatedAt
          };

          csvStream.write(record);
        } catch(err) {
          console.err(err);
        }
      })
      .on('end', function() {
        setTimeout(function() {
          csvStream.end();
        }, 25); // odd - timeout needed to get aggregate data in file
       })
      .on('error', function(err) {
        next(err);
        cleanup();
      });
  });
};
