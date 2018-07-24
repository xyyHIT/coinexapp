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

let zbg = function(currTime, params, isJSON, cb) {
  var str = settings.zbg.access_id + currTime;
  if (isJSON) {
    str += JSON.stringify(params);
  } else {
    //string
    str += params;
    //str.replace(new RegExp('=','g'),'');
    //str.replace(new RegExp('&','g'),'');
  }
  str += settings.zbg.secret_key;
  console.log("str ===> " + str);
  cb({signature: md5(str).toLowerCase()});
}
module.exports = {
  signature,
  zbg
}