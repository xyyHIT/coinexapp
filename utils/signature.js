var md5 = require('md5');
var settings = require('../settings');

let signature = function(params, isJSON, cb) {
  var str = '';
  if (isJSON) {
    for(let p in params) {
      str += p + '=' + params[p] + '&';
    }
  } else {
    str = params + '&';
  }
  str += 'secret_key=' + settings.coinex.secret_key;
  cb({signature: md5(str).toUpperCase()});
}

module.exports = {
  signature
}