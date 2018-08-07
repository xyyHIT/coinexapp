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
        'OK-ACCESS-KEY': settings.coinall[user].access_id,
        'OK-ACCESS-SIGN': cb.signature,
        'OK-ACCESS-TIMESTAMP': currTime,
        'OK-ACCESS-PASSPHRASE': settings.coinall[user].Passphrase
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
// 获取币对depth
router.get('/market/depth', (req, res, next) => {
  let currTime = Date.now() / 1000;
  var market = req.query.market;
  var path = '/api/spot/v3/products/' + market + '/book?size=10';
  signature.coinall(currTime, 'GET', path, settings.coinall[0].secret_key, '', false, (cb) => {
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

// 下单
router.get('/market/order', (req, res, next) => {
  let currTime = Date.now() / 1000;
  let params = {
    product_id: req.query.market,
    type: req.query.type ? req.query.type : 'limit', // 	limit or market
    side: req.query.side, // buy or sell
    size: req.query.size
  }
  if (params.type == 'limit') {
    params.price = req.query.price
  } else if (params.type == 'market') {
    params.funds = req.query.funds
  }
  let path = '/api/spot/v3/orders';
  signature.coinall(currTime, 'POST', path, settings.coinall[0].secret_key, params, true, (cb) => {
    console.log(JSON.stringify(cb));
    var options = {
      url: API_URI + path,
      headers: {
        'OK-ACCESS-KEY': settings.coinall[0].access_id,
        'OK-ACCESS-SIGN': cb.signature,
        'OK-ACCESS-TIMESTAMP': currTime,
        'OK-ACCESS-PASSPHRASE': settings.coinall[0].Passphrase
      },
      method: 'POST',
      json: true,
      body: params
    }
    request(options, (err, response, body) => {
      if (err) {

      } else {
        res.json(body);
      }
    })
  })
})

// 撤销订单
router.get('/market/cancel', (req, res, next) => {
  let currTime = Date.now() / 1000;
  let params = {
    product_id: req.query.market,
  }
  let path = '/api/spot/v3/orders/' + req.query.order_id;
  signature.coinall(currTime, 'DELETE', path, settings.coinall[0].secret_key, params, true, (cb) => {
    console.log(JSON.stringify(cb));
    var options = {
      url: API_URI + path,
      headers: {
        'OK-ACCESS-KEY': settings.coinall[0].access_id,
        'OK-ACCESS-SIGN': cb.signature,
        'OK-ACCESS-TIMESTAMP': currTime,
        'OK-ACCESS-PASSPHRASE': settings.coinall[0].Passphrase
      },
      method: 'DELETE',
      json: true,
      body: params
    }
    request(options, (err, response, body) => {
      if (err) {

      } else {
        res.json(body);
      }
    })
  })
})

// 获取未完成的订单
router.get('/market/pending', (req, res, next) => {
  let currTime = Date.now() / 1000;
  let path = '/api/spot/v3/orders_pending';
  signature.coinall(currTime, 'GET', path, settings.coinall[0].secret_key, '', false, (cb) => {
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
      json: true,
      body: params
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