exports.getPrice = function(num){
  var price = (num/100).toFixed(2);
  return isNaN(price) ? 0 : price;
}

exports.setPrice = function(num){
  var price = num*100;
  return isNaN(price) ? 0 : price;
}