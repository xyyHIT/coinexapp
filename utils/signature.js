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

let digifinex = function (params, cb) {
  let keys = Object.keys(params).sort(),
    arr = [];
  keys.forEach(function (key) {
    arr.push(params[key]);
  });
  let sign = md5(arr.join(''));
  cb({
    signature: sign
  })
}

let bigone = function (access_id, secret_key, cb) {
  let header = {
    "alg": "HS256",
    "typ": "JWT"
  }
  let tmp1 = new Buffer(JSON.stringify(header)).toString('base64');
  let payload = {
    "type": "OpenAPI",
    "sub": access_id,
    "nonce": Date.now() * 1000000
  }
  let tmp = new Buffer(JSON.stringify(payload)).toString('base64');
  let str = (tmp1 + "." + tmp).replace(new RegExp('=', 'g'), '');
  const hash = crypto.createHmac('sha256', secret_key)
    .update(str).digest('base64').replace(new RegExp('=', 'g'), '');;
  // let payload = {
  //   "type": "OpenAPI",
  //   "sub": "376df127-985d-4e23-9932-027cd29a74fd",
  //   "nonce": 1533713182560000000
  // }
  // let tmp = new Buffer(JSON.stringify(payload)).toString('base64');
  // console.log(JSON.stringify(payload));
  // let hash = jwt.sign(payload, '89435FE853BD558F67E8D645BEBCBE81F6F3FB6A10B9F983C321B36906DDE3BB');
  // console.log(hash.toString());
  cb({
    signature: str + "." + hash
  })
}

module.exports = {
  signature,
  zbg,
  asiaex,
  coinall,
  bitforex,
  digifinex,
  bigone
}