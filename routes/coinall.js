var express = require('express');
var router = express.Router();
var request = require('request');
var signature = require('../utils/signature');
var settings = require('../settings');
var async = require('async');
let API_URI = 'https://www.coinall.com';

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
// 查询我的虚拟币信息
router.get('/account/balance', (req, res, next) => {
  let currTime = Date.now() / 1000;
  let user = req.query.user;
  var path = '/api/spot/v3/accounts';
  if (req.query.currency) {
    path += "/" + req.query.currency;
  }
  signature.coinall(currTime, 'GET', path, settings.coinall[user].secret_key, '', false, (cb) => {
    console.log(JSON.stringify(cb));
    var options = {
      url: API_URI + path,
      headers: {
        'OK-ACCESS-KEY': settings.coinall[0].access_id,
        'OK-ACCESS-SIGN': cb.signature,
        'OK-ACCESS-TIMESTAMP': currTime,
        'OK-ACCESS-PASSPHRASE': settings.coinall[0].Passphrase
      },
      method: 'GET',
      json: true
    }
    request(options, (err, response, body) => {
      if (err) {

      } else {
        res.json(body);
      }
    })
  })
})

module.exports = router;