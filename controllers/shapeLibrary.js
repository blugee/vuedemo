var Shape = require('../models/Shape');
var ShapeCategory = require('../models/ShapeCategory');
var ShapeBrand = require('../models/ShapeBrand');
var ShapeOrientation = require('../models/ShapeOrientation');
var User = require('../models/User');
var ObjectId = require('mongoose').Types.ObjectId;
var fs = require('fs');
var _ = require('lodash');

/**
 * GET /
 * Home page.
 */
exports.index = function(req, res, next) {
  let user = req.user;
  let page = req.query.page || req.cookies.page;
  var search = req.query.search || req.cookies.search;
  var query = {};

  var opts = {
    //sort: { name: 1 },
    populate: ['owner', 'category', 'brand'],
    page: Math.max(1, parseInt(page || 1)),
    limit: Math.max(15, parseInt(req.query.size || 15)),
    //lean: true
  };

  if (!!search) {
    query['$or'] = [
      { 'name': RegExp(''+search, 'i') }
    ];
  }

  Shape.paginate(query, opts, function(err, shapes){
    if (err) return next(err);
    shapes.search = search || '';
    shapes.isAdmin = user.isAdmin();
    if (shapes.page) {
      res.cookie('page', shapes.page, {path: '/shapes'});
    }
    res.render('shapes/index', shapes);
  });
};

exports.searchForShapeJSON = function(req, res) {
  var re;
  var quantity = 25;
  var start = 0;
  var total = 0;
  var or;
  var searchQuery;
  var directionTerm = '$lte';
  var where = {};
  var last = 0;

  req.query.showPrivateShapes = req.query.showPrivateShapes === 'true';
  var showPrivateShapes = req.user ? req.query.showPrivateShapes : false;
  var showPublicShapes = req.query.showPublicShapes === 'true';

  if(!req.query.hasOwnProperty('text')) req.query.text = '';

  if(req.query.text === '' && !req.query.category && !showPrivateShapes && !showPublicShapes) {
    return res.json({total: 0, shapes: []});
  }
  if(req.query.text === ''){
    searchQuery = {};
  } else {
    var searchText = req.query.text;

    var wordsArr = searchText.split(' ');

    searchQuery = {};
    searchQuery.$and = [];
    wordsArr.forEach(function (word) {
      if (word !== '') {
        searchQuery.$and.push({
          $or: [
            {
              name: {
                $regex: word,
                $options: "i"
              }
            },
            {
              desc: {
                $regex: word,
                $options: "i"
              }
            }
          ]
        });
      }
    });
  }

  if(req.query.hasOwnProperty('start')) {
    if(req.query.start !== '0') {
      where = {name: {$gt: req.query.start}};
    }
  }

  if(req.query.hasOwnProperty('category') && req.query.category !== '') {
    searchQuery.category = req.query.category;
  }
  if(req.query.hasOwnProperty('brand') && req.query.brand !== '') {
    searchQuery.brand = req.query.brand;
  }
  if(req.query.hasOwnProperty('quantity')) {
    quantity = parseInt(req.query.quantity);
  }

  var userRoles = require('./../lib/globals').userRoles;
  if (!req.user || req.user.role.name !== userRoles.admin && req.user.role.name !== userRoles.librarian) {
    searchQuery.available = 'true';
  }

  // query for private, shared, and public shapes accordingly
  searchQuery.$or = [];
  if (showPrivateShapes) {
    if (showPublicShapes) {
      searchQuery.$or.push({owner: {$in: [req.user._id, null]}});
    } else {
      searchQuery.$or.push({owner: req.user._id});
    }

    // get all "shared with me" shapes when querying private shapes
    searchQuery.$or.push({sharedUsers: req.user.email});
  } else {
    searchQuery.$or.push({owner: {$in: [null]}});
    if (req.user) {
      searchQuery.$or.push({sharedUsers: req.user.email});
    }
  }

  var doneGettingExcludedCategories = function() {
    Shape.count(searchQuery)
      .exec(function(err, count){
        total = count;
      })
      .then(function(){
        Shape.find(searchQuery)
          .populate({
            path: 'category',
            model: 'ShapeCategory',
            select: 'name'
          })
          .populate({
            path: 'brand',
            model: 'ShapeBrand',
            select: 'name'
          })
          .populate({
            path: 'orientations',
            model: 'ShapeOrientation'
          })
          .limit(quantity)
          .sort('name')
          .where(where)
          .exec(function(err, shapes) {
            if(shapes.length) {
              if(shapes.length >= quantity){
                last = shapes[quantity-1].name;
              } else {
                last = null;
              }
              return res.json({
                total: total,
                shapes: shapes.map(function(s){s.editable = false;return s;}),
                next: last
              });
            } else {
              return res.json({
                total: 0,
                shapes: [],
                next: null
              });
            }
          });
      });
  };

  if(req.query.hasOwnProperty('excludedCategories') && req.query.excludedCategories !== '') {
    var excludedCategories = req.query.excludedCategories; //TODO: this should be handled in the backend, should not be relying on the front end to exclude a category

    if (excludedCategories) {
      ShapeCategory.find(
        {
          name: { $in: req.query.excludedCategories }
        }
      ).exec(function (err, excludedCategories) {
        if (err) {
          // TODO: log error
          return doneGettingExcludedCategories();
        }

        if (!excludedCategories) {
          return doneGettingExcludedCategories();
        }

        // We get passed the name in the URL param, but we only care about ids for filtering
        excludedCategories = excludedCategories.map(function(category) {
          return category.id;
        });
        // keep the existing category query if it's not included in excludedCategories
        var includedCategory;
        if (searchQuery['category'] && excludedCategories.indexOf(searchQuery['category']) === -1) {
          includedCategory = searchQuery['category'];
        }
        delete searchQuery['category'];

        // modify searchQuery to not get any shapes in excludedCategories
        var categoryAndQuery = {
            category: { $nin: excludedCategories }
          };


        if (!searchQuery.$and) searchQuery.$and = [];
        if (includedCategory) {
          categoryAndQuery.category.$in = [ includedCategory ];
        }
        searchQuery.$and.push(categoryAndQuery);

        /*
        The resulting query will look something like this:
        {
          "$and": [
            {
              "$or": [
                {
                  "name": {
                    "$regex": "gar",
                    "$options": "i"
                  }
                },
                {
                  "desc": {
                    "$regex": "gar",
                    "$options": "i"
                  }
                }
              ]
            },
            {
              "category": {
                "$nin": [
                  "58778dff5975e8456b7be0aa"
                ],
                "$in": [
                  "584de9ab1c732a6822ab90e9"
                ]
              }
            }
          ],
          "available": "true",
          "$or": [
            {
              "owner": {
                "$in": [
                  null
                ]
              }
            }
          ]
        }
        */

        doneGettingExcludedCategories();
      });
    } else {
      doneGettingExcludedCategories();
    }
  } else {
    doneGettingExcludedCategories();
  }
};

exports.deleteBrandFromCategoryJSON = function(req, res) {
  ShapeCategory.findById(req.params.categoryId)
  .populate('brands')
  .exec(function(err, foundCategory){
    if(err) {
      return res.status(404).json({msg: 'That category cannot be found', err: err});
    }
    foundCategory.brands.forEach(function(b, i){
      if(b._id.toString() === req.params.brandId) {
        foundCategory.brands.splice(i, 1);
      }
    });
    foundCategory.save(function(err, savedCategory){
      if(err){
        return res.status(500).json({msg: 'That category cannot be saved', err: err});
      }
      savedCategory.populate('brands', function(err, populatedSavedCategory){
        return res.json(populatedSavedCategory);
      });
    });
  });
};

exports.putShapeBrandJSON = function(req, res) {
  ShapeBrand.findById(req.params.id, function(err, brand){
    if(err) {
      return res.status(404).json({msg: 'That brand does not exist.'});
    }
    if(req.body.hasOwnProperty('name')){
      brand.name = req.body.name;
    }
    brand.save(function(err, brand){
      if(err){
        return res.status(500).json({msg: 'That brand cannot be updated at this time', err: err});
      }
      return res.json(brand);
    });
  });
};

exports.putShapeCategoryJSON = function(req, res) {
  ShapeCategory.findById(req.params.id)
  .populate('brands')
  .exec(function(err, category){
    var index = 0;
    var brands = [];
    var error = false;
    if(err) {
      return res.status(404).json({msg: 'That category does not exist.'});
    }

    if(req.body.hasOwnProperty('name')){
      category.name = req.body.name;
    }

    function done() {
      if(error) { return; }
      category.save(function(err, savedShapeCategory){
        if(err) {
          res.status(500).json({msg: 'Unable to update this category at this time.', err: err});
          return;
        }
        ShapeCategory.findById(category._id)
        .populate('brands')
        .exec(function(err, category){
          if(err) {
            res.status(404).json({msg: 'Unable to find that category at this time.', err: err});
          }
          res.json(category);
        });
      });
    }

    if(req.body.hasOwnProperty('brands')){
      function next() {
        if(index > req.body.brands.length-1){
          done();
          return;
        }
        var brand = req.body.brands[index];
        ShapeBrand.findById(brand, function(err, foundBrand){
          var brandExistsAlready = false;
          if(err) {
            res.status(500).json({msg: 'Unable to find or update the brands for that category.', err: err});
            index = Infinity;
            error = true;
            return;
          }
          brandExistsAlready = category.brands.some(function(b){
            return foundBrand._id === b._id;
          });
          if(!brandExistsAlready){
            category.brands.push(foundBrand);
          }
          index++;
          next();
        });
      }
      next();
    } else {
      done();
    }
  });
};

exports.updateShapeJSON = function(req, res) {
  Shape.findById(req.params.id, function(err, shape){
    if(err){
      return res.status(404).json({msg: 'That shape does not exist.'});
    }

    // if the shape is not the current user's, make sure the user is at least a librarian
    if (!shape.owner || !shape.owner.equals(req.user._id)) {
      var userRoles = require('./../lib/globals').userRoles;
      if (!(req.user.role.name === userRoles.librarian || req.user.role.name === userRoles.admin)) {
        return res.status(403).json({err: 'unauthorized to edit a shape in the public library'});
      }
    }

    if(req.body.hasOwnProperty('name')){
      shape.name = req.body.name;
    }
    if(req.body.hasOwnProperty('desc')){
      shape.desc = req.body.desc;
    }

    if(req.body.hasOwnProperty('mfrID')){
      shape.mfrID = req.body.mfrID;
    }
    if(req.body.hasOwnProperty('available')){
      shape.available = req.body.available;
    }
    if(req.body.hasOwnProperty('verified')){
      shape.verified = req.body.verified;
    }

    if(req.body.hasOwnProperty('orientations')){
      var orientations = [];

      req.body.orientations.map(function(orientation){
        if (orientation._id !== '') {
          ShapeOrientation.findOne({_id : orientation._id}, function(err, foundOrientation) {
            if(err) {
              return res.status(404).json({msg: 'That orientation does not exist.', err: err});
            }

            if(orientation.thumb !== foundOrientation.thumb && foundOrientation.newImage !== undefined){
              foundOrientation.newImage = undefined;
            }
            foundOrientation.name = orientation.name;
            foundOrientation.data = orientation.data;
            foundOrientation.length = orientation.length;
            foundOrientation.width = orientation.width;
            foundOrientation.depth = orientation.depth;
            foundOrientation.thumb = orientation.thumb;

            foundOrientation.save();
          });
        } else {
          var newOrientation = new ShapeOrientation({
            name: orientation.name,
            data: orientation.data,
            shape: shape._id,
            length: orientation.length,
            width: orientation.width,
            depth: orientation.depth,
            thumb: orientation.thumb
          });
          orientations.push(newOrientation);
        }
      });
      var orientationsToDelete = [];
      shape.orientations.forEach(function(orientationShape){
        var orientShape = orientationShape + "";
        var isRemove = true;
        req.body.orientations.forEach(function(orientation) {
          if(orientation._id === orientShape){
            isRemove = false;
            return true;
          }
        });
        if(isRemove === true){
          orientationsToDelete.push(orientationShape);
        }
      });

      // Verify whether new guidelines will be created
      if(orientations.length > 0){
        ShapeOrientation.insertMany(orientations, function(err, orientationsSaved){
          if(err) { return res.status(500).json({err:err});}

          var savedOrientations = [];
          orientationsSaved.forEach(function(orientation){
            savedOrientations.push(orientation._id);
          });
          Shape.update({_id : req.params.id},{ $push: { orientations: { $each: savedOrientations } } },function(err, success) {
            if(err) {
              return res.status(404).json({msg: 'Error updating Shape Orientation', err: err});
            }
          });
        });
      }

      // Verify if there are any guidelines to eliminate
      if(orientationsToDelete.length > 0) {
        Shape.update({_id : req.params.id},{ $pull: { orientations: { $in: orientationsToDelete } } },{ multi: true },function(err, success) {
          if(err) {
            return res.status(404).json({msg: 'Error updating Shape Orientation', err: err});
          }

          ShapeOrientation.remove({shape : req.params.id, _id : { $in : orientationsToDelete} }, function(err, success) {
            if(err) {
              return res.status(404).json({msg: 'Error deleting ShapeOrientation', err: err});
            }
          });
        });
      }
    }

    if(req.body.category && req.body.brand) {
      ShapeCategory.findById(req.body.category, function(err, foundCategory) {
        if(err) {
          return res.status(404).json({msg: 'That category does not exist', err: err});
        }
        ShapeBrand.findById(req.body.brand, function(err, foundBrand){
          if(err) {
            return res.status(404).json({msg: 'That brand does not exist', err: err});
          }
          shape.category = foundCategory;
          shape.brand = foundBrand;
          shape.save();
        });
      });
    }
    shape.save(function(err, shape){
      return res.json({'_id':shape._id, 'name': shape.name, 'desc': shape.desc});
    });
  });
};

exports.updateShapeSharedUsersJSON = function (req, res) {
  Shape.findOne(
    {
      _id: req.params.id
    })
    .exec(function(err, shape){
      if(err){
        return res.status(404).json({msg: 'shape_does_not_exist'});
      }

      // if the shape is not the current user's, make sure the user is at least a librarian
      if (!shape.owner || !shape.owner.equals(req.user._id)) {
        var userRoles = require('./../lib/globals').userRoles;
        if (!(req.user.role.name === userRoles.librarian || req.user.role.name === userRoles.admin)) {
          return res.status(403).json({err: 'unauthorized'});
        }
      }

      var sharedUsers = _.uniq(req.body.sharedUsers);
      sharedUsers = sharedUsers.map(function(email) {
        return (typeof email === 'string') ? email.toLowerCase() : email;
      });
      if (typeof sharedUsers[0] === 'undefined') {
        shape.sharedUsers = [];
        shape.save(function(saveErr, savedShape) {
          if (saveErr) {
            return res.status(500).json({msg: 'shape_sharing_error'});
          } else {
            return res.json(savedShape);
          }
        });
      } else {
        if (sharedUsers.length !== req.body.sharedUsers.length) {
          return res.status(500).json({msg: 'duplicate_email_address'});
        } else if (sharedUsers.indexOf(req.user.email) !== -1) {
          return res.status(500).json({msg: 'cannot_share_shape_with_yourself'});
        } else {
          User.count({email: { $in: sharedUsers }}).exec(function(countErr, count) {
            if (!countErr) {
              if (count !== sharedUsers.length) {
                // err
                return res.status(500).json({msg: 'invalid_user_email'});
              } else {
                shape.sharedUsers = sharedUsers;
                shape.save(function (saveErr, savedShape) {
                  if (saveErr) {
                    return res.status(500).json({msg: 'shape_sharing_error'});
                  } else {
                    return res.json(savedShape);
                  }
                });
              }
            } else {
              return res.status(500).json({msg: 'shape_sharing_error'});
            }
          });
        }
      }
  });
};

exports.postNewShapeCategoryJSON = function(req, res) {
  var i = 0;
  if(req.body.hasOwnProperty('name')) {
    var shapeCategory = new ShapeCategory({
      name: req.body.name,
      brands: req.body.brands || []
    });
    shapeCategory.save(function(err, savedShapeCategory){
      if(err) {
        return res.status(500).json({msg: 'Could not save your shape category at this time'});
      } else {
        function done(){
          ShapeCategory
          .find()
          .populate('brands')
          .then(function(categories){
            return res.json({categories: categories});
          });
        }
        function next(){
          if(i > req.body.brands.length-1) {
            done();
            return;
          }
          ShapeBrand.findById(req.body.brands[i], function(err, foundBrand){
            foundBrand.categories.push(savedShapeCategory);
            foundBrand.save(function(err){
              if(err) {
                return res.status(500).json({msg: 'Could not save your brands.'});
              }
              i++;
              next();
            });
          });
        }
        if(req.body.brands){
          next();
        } else {
          done();
        }
      }
    });
  } else {
    return res.status(401).json({msg: 'Missing name parameter to save shape category.'});
  }
};

exports.postNewShapeBrandJSON = function(req, res) {
  if(req.body.hasOwnProperty('name')) {
    var shapeBrand = new ShapeBrand({
      name: req.body.name
    });
    shapeBrand.save(function(err){
      if(err) {
        return res.status(500).json({msg: 'Could not save your shape brand at this time'});
      } else {
        ShapeBrand
          .find()
          .then(function(brands){
            return res.json({brands: brands});
          });
      }
    });
  } else {
    return res.status(401).json({msg: 'Missing name parameter to save shape brand.'});
  }
};

exports.postNewShapeImage = function(req, res) {
  Shape.findById(req.body.id, function(err, shape){
    // 'newImage' property is deleted to give priority to the 'thumb' property
    shape.newImage = undefined;
    shape.thumb = req.file.filename;
    shape.thumbMime = req.file.mimetype;
    shape.thumbPath = "./public/uploads/";
    shape.save(function(err, shape){
      if(err) {
        res.json(err);
        return;
      }
      return res.json(shape);
    });
  });
};

exports.postNewShapeJSON = function(req, res) {
  var newShape;
  var data;
  if(req.body.hasOwnProperty('shapeData')) {
    data = JSON.parse(req.body.shapeData);
    var shapeObj = {
      name: data.name,
      available: data.available,
      orientations: [],
      desc: data.desc,
    };
    if (req.body.isPrivate && req.body.isPrivate !== 'false') {
      shapeObj.owner = req.user._id;
    } else {
      // only require brand & category on non-private shapes
      if (!data.brand || !data.category) {
        return res.status(500).json({err: 'missing brand and category'});
      }

      // if the shape is not private, make sure the user is at least a librarian
      var userRoles = require('./../lib/globals').userRoles;
      if (!(req.user.role.name === userRoles.librarian || req.user.role.name === userRoles.admin)) {
        return res.status(403).json({err: 'unauthorized to add a shape to the public library'});
      }

      // push brand and category here, since it's a public shape object
      shapeObj.brand = data.brand;
      shapeObj.category = data.category;
      shapeObj.mfrID = data.mfrID;
    }
    newShape = new Shape(shapeObj);
    newShape.save(function(err, savedShape){
      if(err) {
        return res.status(500).json({err: err});
      }
      if(data.hasOwnProperty('orientations')) {
        var orientations = data.orientations.map(
          function(orientation){
          return new ShapeOrientation({
            name: orientation.name,
            data: orientation.data,
            shape: savedShape._id,
            length: orientation.length,
            width: orientation.width,
            depth: orientation.depth,
            thumb: orientation.thumb
          });
        });
        ShapeOrientation.insertMany(orientations, function(err, savedOrientations){
          if(err) { return res.status(500).json({err:err});}
          newShape.orientations = savedOrientations;
          newShape.save(function(err, resavedShape) {
            if(err) { return res.status(500).json({err:err});}
            return res.json(newShape);
          });
        });
      } else {
        return res.status(401).json({err: 'missing orientations'});
      }
    });
  } else {
    return res.status(401).json({err: 'missing shape data'});
  }
};

exports.getShapeCategoriesJSON = function(req, res) {
  var searchQuery = {};
  if (req.query.storeRegion === 'JPN') {
    // custom rule to filter out the "Firearms/Rifles" category if the store is in Japan
    searchQuery['name'] = { $ne: "Firearms/Rifles" }
  }

  ShapeCategory
    .find(searchQuery)
    .populate({
      path: 'brands',
      options: {
        sort: {
          name: 1
        }
      }
    })
    .sort({
      name: 1
    })
    .then(function(categories) {
      res.json(categories);
    });
};

exports.getShapeBrandsJSON = function(req, res) {
  ShapeBrand
    .find()
    .then(function(brands) {
      res.json(brands);
    });
};

exports.deletePrivateShapeJSON = function(req, res) {
  Shape.remove({
    _id: req.params.id,
    owner: req.user._id
  }, function (err) {
    if (err) {
      res.status(401);
    }
    res.json({status: 'OK'});
  });
};
