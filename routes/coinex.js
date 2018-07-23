var express = require('express');
var router = express.Router();
var request = require('request');
var signature = require('../utils/signature');
var settings = require('../settings');


router.get('/account', function(req, res, next) {
  let currTime = Date.now();
  var str = "access_id="+settings.coinex.access_id+"&tonce="+currTime;
  signature.signature(str, false, function(cb) {
    console.log("cb ===>" + JSON.stringify(cb));
    let options = {
      url: 'https://api.coinex.com/v1/balance/info',
      headers: {
        authorization: cb.signature
      },
      qs: {
        access_id: settings.coinex.access_id,
        tonce: currTime
      },
      json:true,
    }
    console.log('options ===> '+ JSON.stringify(options));
    request.get(options, (err, response, body) => {
      if (err) {

      } else {
        res.json(body);
      }
    })
  } )
});

router.get('/market', function(req, res, next) {
  let options = {
    url: 'https://api.coinex.com/v1/market/list',
    json: true
  }
  request.get(options, (err, response, body) => {
    if (err) {

    } else {
      console.log("devices body ===>" + JSON.stringify(body));

    }
  })
});

router.get('/market/ticker', function(req, res, next) {
  let options = {
    url : 'https://api.coinex.com/v1/market/ticker',
    json: true,
    qs: {
      market: 'CETBCH'
    }
  }
  let markets = ["CETBCH","CETBTC","CETETH","CETUSDT"];

  request.get(options, (err, response, body) => {
    if (err) {

    } else {
      console.log("price ===>" + JSON.stringify(body));
    }
  })
});

router.get('/market/deals', function(req, res, next) {
  let options = {
    url : 'https://api.coinex.com/v1/market/deals',
    json: true,
    qs: {
      market: 'CETBCH',
      last_id: 1
    }
  }

  request.get(options, (err, response, body) => {
    if (err) {

    } else {
      console.log("price ===>" + JSON.stringify(body));
      res.json(body);
    }
  })
})

router.post('/trading/place_market', (req, res, next) => {
  let currTime = Date.now();
  var postBody = {
    access_id: settings.coinex.access_id,
    amount: req.body.amount,
    market: req.body.market,
    tonce: currTime,
    type: req.body.type
  }
  signature.signature(postBody, true, (cb) => {
    console.log("cb ===>" + JSON.stringify(cb));
    let options = {
      url: 'https://api.coinex.com/v1/order/market',
      method: 'post',
      headers: {
        authorization: cb.signature
      },
      json: true,
      body: postBody
    }
    request(options, (err, response, body) => {
      if (err) {
        ret.json({result: err});
      } else {
        console.log(JSON.stringify(body));
        res.json(body);
      }
    })
  })
})

router.post('/trading/place_limit', (req, res, next) => {
  let currTime = Date.now();
  var postBody = {
    access_id: settings.coinex.access_id,
    amount: req.body.amount,
    market: req.body.market,
    price: req.body.price,
    tonce: currTime,
    type: req.body.type
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
        console.log(JSON.stringify(body));
        res.json(body);
      }
    })
  })
});

module.exports = router;