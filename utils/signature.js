var md5 = require('md5');
var NodeRSA = require('node-rsa');
var crypto = require('crypto');
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
  console.log(JSON.stringify(param));
  //param = '{"secretKey":"F7L63G3HFizw466RIIhNguWbtFSfJjTS","type":"0","pairname":"BACETH","price":"0.0000851","count":"500"}';
  // let key = new NodeRSA(settings.asiaex.public_key, {
  //   encryptionScheme: 'pkcs1'
  // });
  // let encrypted = key.encrypt(param, 'base64');
  // var key = {
  //   key: settings.asiaex.public_key,
  //   padding: crypto.constants.RSA_PKCS1_PSS_PADDING
  // }
  let key = {
    key: settings.asiaex.public_key,
    padding: crypto.constants.RSA_PKCS1_PADDING
  }
  let encrypted = crypto.publicEncrypt(key, Buffer.from(JSON.stringify(param)));
  console.log("encrypted ===> " + encrypted.toString('base64'));
  cb({
    signature: encrypted.toString('base64')
  });
}


module.exports = {
  signature,
  zbg,
  asiaex
}