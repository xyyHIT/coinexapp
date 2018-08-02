var md5 = require('md5');
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

let zbg = function (zbg_user, currTime, params, isJSON, cb) {
  var str = zbg_user.access_id + currTime;
  if (isJSON) {
    str += JSON.stringify(params);
  } else {
    //string
    str += params;
    //str.replace(new RegExp('=','g'),'');
    //str.replace(new RegExp('&','g'),'');
  }
  str += zbg_user.secret_key;
  console.log("str ===> " + str);
  cb({
    signature: md5(str).toLowerCase()
  });
}

let asiaex = function (param, public_key, cb) {
  let key = {
    key: public_key,
    padding: crypto.constants.RSA_PKCS1_PADDING
  }
  let encrypted = crypto.publicEncrypt(key, Buffer.from(JSON.stringify(param)));
  cb({
    signature: encrypted.toString('base64')
  });
}

let coinall = function (currTime, method, request_path, secret_key, params, isJSON, cb) {
  var str = currTime + method.toUpperCase() + request_path;
  if (isJSON) {
    str += JSON.stringify(params);
  } else {
    //string
    str += params;
    //str.replace(new RegExp('=','g'),'');
    //str.replace(new RegExp('&','g'),'');
  }
  console.log("str ===> " + str);
  const hash = crypto.createHmac('sha256', secret_key)
    .update(str)
    .digest('base64');
  cb({
    signature: hash
  });
}

let bitforex = function (secret_key, path, params, isJSON, cb) {
  var str = path;
  if (isJSON) {
    for (let p in params) {
      str += p + '=' + params[p] + '&';
    }
    str = str.substring(0, str.length - 1);
  } else {
    str = params;
  }
  const hash = crypto.createHmac('sha256', secret_key)
    .update(str)
    .digest('hex');
  cb({
    signature: str + '&signData=' + hash
  });
}

module.exports = {
  signature,
  zbg,
  asiaex,
  coinall,
  bitforex
}