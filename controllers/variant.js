var Variant = require('../models/Variant');

exports.editVariant = function(req, res) {
  Variant.findOne({
    _id: req.params.id
  }, function(err, foundVariant) {
    var updated = false;
    if(!foundVariant) {
      res.json({
        status: 'BAD',
        message: '404'
      });
      return;
    }
    if(req.body.hasOwnProperty('modifier')) {
      foundVariant.modifier = req.body.modifier/100;
      updated = true;
    }
    if(req.body.hasOwnProperty('modifierType')) {
      foundVariant.modifierType = req.body.modifierType;
      updated = true;
    }
    if(updated) {
      foundVariant.save(function(){
        res.json({
          status: 'OK',
          message: 'Variant updated'
        });
      });
    } else {
      res.json({
        status: 'BAD',
        message: 'Variant not updated'
      });
    }
  });
};

exports.deleteVariant = function(req, res) {
  Variant.findOne({
    _id: req.params.id
  }, function(err, foundVariant) {
    if(!foundVariant) {
      res.json({
        status: 'BAD',
        message: '404'
      });
      return;
    }

    foundVariant.remove(function() {
      res.json({
        status: 'OK',
        message: 'Variant deleted'
      })
    });
  });
};