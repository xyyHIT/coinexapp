var express = require('express');
var router = express.Router();
var request = require('request');

router.get('/', function(req, res, next) {
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

router.get('/price', function(req, res, next) {
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

router.get('/deals', function(req, res, next) {
  let options = {
    url : 'https://api.coinex.com/v1/market/deals',
    json: true,
    qs: {
      market: 'CETBCH',
      last_id: 1
    }
  }
  let markets = ["CETBCH","CETBTC","CETETH","CETUSDT"];

  request.get(options, (err, response, body) => {
    if (err) {

    } else {
      console.log("price ===>" + JSON.stringify(body));
      res.json(body);
    }
  })
})



module.exports = router;