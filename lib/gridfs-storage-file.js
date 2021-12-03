'use strict';

var crypto = require('crypto');
var mime = require('mime-types');

module.exports = function(req, file) {
  return new Promise((resolve, reject) => {
    crypto.randomBytes(16, (err, buf) => {
      if (err) {
        return reject(err);
      }
      var filename = buf.toString('hex') + '.' + mime.extension(file.mimetype);
      var fileInfo = {
        filename: filename,
        metadata: {
          originalFileName: file.originalname,
          fromUrl: req.path,
          byUser: (!!req.user ? req.user._id : null)
        }
      };
      resolve(fileInfo);
    });
  });
};
