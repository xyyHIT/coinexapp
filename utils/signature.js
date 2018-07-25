var md5 = require('md5');
var NodeRSA = require('node-rsa');
var settings = require('../settings');

let signature = function (params, isJSON, cb) {
  var str = '';
  if (isJSON) {
    for (let p in params) {
      str += p + '=' + params[p] + '&';
    }
  } else {
    str = params + '&';
  }
  str += 'secret_key=' + settings.coinex.secret_key;
  cb({
    signature: md5(str).toUpperCase()
  });
}

let zbg = function (currTime, params, isJSON, cb) {
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
  cb({
    signature: md5(str).toLowerCase()
  });
}

let asiaex = function (param, cb) {
  //param = '{"secretKey":"5DpP1Vgq5tUXwngHcJAYR1EnRamVuBBt","type":"1","pairname":"BCHCNY","price":"500","count":"1"}';
  let key = new NodeRSA(settings.asiaex.public_key);
  let encrypted = key.encrypt(param, 'base64');
  cb({
    signature: encrypted
  });
}
module.exports = {
  signature,
  zbg,
  asiaex
}