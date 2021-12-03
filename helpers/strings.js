exports.toTitleCase = function(str){
  return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

exports.randomNumChars = function(num) {
  var text = '';
  var possible = 'abcdefghijklmnopqrstuvwxyz0123456789';

  for(var i=0; i < num; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

exports.hasParams = function(req, params) {
  return params.every(function(param) {
    return req.query.hasOwnProperty(param);
  });
};

exports.hasSomeParams = function(req, params) {
  return params.some(function(param) {
    return req.query.hasOwnProperty(param);
  });
};