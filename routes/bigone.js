var express = require('express');
var router = express.Router();
var request = require('request');
var signature = require('../utils/signature');
var settings = require('../settings');
var async = require('async');
let API_URI = 'https://big.one/api/v2';

router.get('/viewer/accounts', (req, res, next) => {
  signature.bigone(settings.bigone[0].access_id, settings.bigone[0].secret_key, (cb) => {
    console.log(JSON.stringify(cb));
    let options = {
      url: API_URI + '/viewer/accounts',
      method: 'get',
      headers: {
        Authorization: "Bearer " + cb.signature
      },
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

router.get('/market/depth', (req, res, next) => {
  let market = req.query.market;
  signature.bigone(settings.bigone[0].access_id, settings.bigone[0].secret_key, (cb) => {
    console.log(JSON.stringify(cb));
    let options = {
      url: API_URI + '/markets/' + market + '/depth',
      method: 'get',
      headers: {
        Authorization: "Bearer " + cb.signature
      },
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

router.get('/market/limitOrder', (req, res, next) => {
  let market = req.query.market;
  let user = req.query.user;
  let type = req.query.type;
  let price = req.query.price;
  let amount = req.query.amount;
  signature.bigone(settings.bigone[user].access_id, settings.bigone[user].secret_key, (cb) => {
    console.log(JSON.stringify(cb));
    let options = {
      url: API_URI + '/markets/' + market + '/depth',
      method: 'post',
      headers: {
        Authorization: "Bearer " + cb.signature
      },
      json: true,
      form: {
        market_id: market,
        side: type,
        price: price,
        amount: amount
      }
    }
    request(options, (err, response, body) => {
      if (err) {

      } else {
        res.json(body);
      }
    })
  })
})

router.get('/market/cancelOrder', (req, res, next) => {
  let user = req.query.user;
  let order_id = req.query.orderId;
  signature.bigone(settings.bigone[user].access_id, settings.bigone[user].secret_key, (cb) => {
    console.log(JSON.stringify(cb));
    let options = {
      url: API_URI + '/viewer/orders/' + order_id + '/cancel',
      method: 'post',
      headers: {
        Authorization: "Bearer " + cb.signature
      },
      json: true,
      form: {
        order_id: order_id
      }
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