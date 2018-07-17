var express = require('express');
var router = express.Router();
var request = require('request');
var settings = require('../settings');
var signature = require('../utils/signature');

router.post('/place_limit', (req, res, next) => {
  let currTime = Date.now();
  var postBody = {
    access_id: settings.access_id,
    amount: '0.00000001',
    market: 'CETBCH',
    price: '0.00013899',
    tonce: currTime,
    type: 'sell'
  }
  var bodyMap = new Map();
  bodyMap.set('access_id', settings.access_id);
  bodyMap.set('amount', '0.00000001');
  bodyMap.set('market', 'CETBCH');
  bodyMap.set('price', '0.00013899');
  bodyMap.set('tonce', currTime);
  bodyMap.set('type', 'sell');
  signature.signature(bodyMap, true, (cb) => {
    console.log("cb ===>" + JSON.stringify(cb));
    let options = {
      url: 'https://api.coinex.com/v1/order/limit',
      method: 'post',
      headers: {
        authorization: cb.signature
      },
      json: true,
      body: postBody
    }
    request(options, (err, response, body) => {
      if (err) {

      } else {
        res.json(body);
      }
    })
  })
});

module.exports = router;