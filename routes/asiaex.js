var express = require('express');
var router = express.Router();
var request = require('request');
var signature = require('../utils/signature');
var settings = require('../settings');


router.post('/entrustSubmitCus', (req, res, next) => {
  let post_data = {
    secretKey: settings.asiaex.secret_key,
    type: "1",
    pairname: "BACBTC",
    price: "0.0000079",
    count: "200"
  }
  signature.asiaex(post_data, (cb) => {
    console.log(cb);
    let post_body = {
      apiKey: settings.asiaex.api_key,
      data: cb.signature
    }
    let post_options = {
      url: 'https://www.bitasiabit.com/app/v1/entrustSubmitCus',
      method: 'post',
      json: true,
      body: post_body
    }
    request(post_options, (err, response, body) => {
      if (err) {

      } else {
        res.json(body);
      }
    })
  })
})

module.exports = router;