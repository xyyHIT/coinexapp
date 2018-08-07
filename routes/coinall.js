var express = require('express');
var router = express.Router();
var request = require('request');
var signature = require('../utils/signature');
var settings = require('../settings');
var async = require('async');

router.get('/account/wallet', (req, res, next) => {
  let currTime = Date.now() / 1000;
  var options = {
    url: 'https://www.coinall.com/api/account/v3/wallet',
    method: 'GET',
    json: true
  }
  signature.coinall(currTime, 'GET', '/api/account/v3/wallet', settings.coinall[0].secret_key, '', false, (cb) => {
    console.log(JSON.stringify(cb));
    options.headers = {
      'OK-ACCESS-KEY': settings.coinall[0].access_id,
      'OK-ACCESS-SIGN': cb.signature,
      'OK-ACCESS-TIMESTAMP': currTime,
      'OK-ACCESS-PASSPHRASE': settings.coinall[0].Passphrase
    }
    request(options, (err, response, body) => {
      if (err) {

      } else {
        res.json(body);
      }
    })
  })
})

function getLocalTime(i) {
  //参数i为时区值数字，比如北京为东八区则输进8,西5输入-5
  if (typeof i !== 'number') return;
  var d = new Date();
  //得到1970年一月一日到现在的秒数
  var len = d.getTime();
  //本地时间与GMT时间的时间偏移差
  var offset = d.getTimezoneOffset() * 60000;
  //得到现在的格林尼治时间
  var utcTime = len + offset;
  return utcTime + 3600000 * i;
}

function getServerTime(currTime) {
  var options = {
    url: 'https://www.coinall.com/api/general/v3/time',
    method: 'GET',
    json: true
  }
  request(options, (err, response, body) => {
    currTime(body.epoch);
  })
}

module.exports = router;