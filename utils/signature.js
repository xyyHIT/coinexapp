var md5 = require('md5');
var settings = require('../settings');

let signature = function(params, isMap, cb) {
  var str = '';
  if (isMap) {
    for([k,v] of params) {
      str += k + '=' + v + '&';
    }
  } else {
    str = params;
  }
  str += 'secret_key=' + settings.secret_key;
  console.log("str ===>" + str);
  cb({signature: md5(str).toUpperCase()});
}

module.exports = {
  signature
}