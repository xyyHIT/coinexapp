var express = require('express');
var router = express.Router();
var request = require('request');
var settings = require('../settings');
var signature = require('../utils/signature');

router.post('/place_limit', (req, res, next) => {
  let currTime = Date.now();
  var postBody = {
    access_id: settings.access_id,
    amount: "15633.70280064",
    market: "CETBCH",
    price: "0.0001391",
    tonce: currTime,
    type: "sell"
  }
  // var bodyMap = new Map();
  // bodyMap.set('access_id', settings.access_id);
  // bodyMap.set('amount', '0.00000001');
  // bodyMap.set('market', 'CETBCH');
  // bodyMap.set('price', '0.00013899');
  // bodyMap.set('tonce', currTime);
  // bodyMap.set('type', 'sell');
  //str = "access_id=6A53206AC2D04AA2BBC889F750FD67B8&amount=15633.70280064&market=CETBCH&price=0.0001391&tonce="+currTime+"&type=sell&secret_key=FFA46235D8A74E50A55613C59680A3D73153238727BE575D";
  signature.signature(postBody, true, (cb) => {
    console.log("cb ===>" + JSON.stringify(cb));
    let options = {
      url: 'https://api.coinex.com/v1/order/ioc',
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
        console.log(JSON.stringify(body));
        res.json(body);
      }
    })
  })
});

module.exports = router;