var express = require('express');
var router = express.Router();
var request = require('request');
var signature = require('../utils/signature');
var settings = require('../settings');


router.post('/userCapitalCus', (req, res, next) => {
  let post_body = {
    secretKey: settings.asiaex[0].secret_key
  }
  signature.asiaex(post_body, settings.asiaex[0].public_key, (cb) => {
    console.log(cb);
    let post_data = {
      apiKey: settings.asiaex[0].api_key,
      data: cb.signature
    }
    let post_options = {
      url: 'https://www.bitasiabit.com/app/v1/userCapitalCus',
      method: 'post',
      json: true,
      body: post_data
    }
    request(post_options, (err, response, body) => {
      if (err) {

      } else {
        res.json(body);
      }
    })
  })
})

router.post('/userEntrustHistoryCus', (req, res, next) => {
  let post_body = {
    secretKey: settings.asiaex[0].secret_key
  }
  signature.asiaex(post_body, settings.asiaex[0].public_key, (cb) => {
    console.log(cb);
    let post_data = {
      apiKey: settings.asiaex[0].api_key,
      data: cb.signature
    }
    let post_options = {
      url: 'https://www.bitasiabit.com/app/v1/userEntrustHistoryCus',
      method: 'post',
      json: true,
      body: post_data
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