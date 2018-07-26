var express = require('express');
var router = express.Router();
var request = require('request');
var signature = require('../utils/signature');
var settings = require('../settings');


router.post('/entrustSubmitCus', (req, res, next) => {
  let post_data = {
    secretKey: settings.asiaex.secret_key,
    type: "0",
    pairname: "BACBTC",
    price: "0.0000079",
    count: "200"
  }
  signature.asiaex(post_data, (cb) => {
    console.log(cb);
    let post_body = {
      apiKey: settings.asiaex.api_key,
      data: 'DRboqF7DyebwmHBvRvfX/CM8GrisB45hpPMy0QhInExveia3TuPGKpGKX0rB30zZ9Bhe1xmgAf+jqezpRP+57Qg2dqX/8KYgWoPK80OfQbDZwsec7tlDZ1hnkEfTDdXdUM7nK8I53V5c0evCF3RLUgkdY2CdsMADNnyDsFXPJ94='
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

router.post('/ccc', (req, res, next) => {
  let post_body = {
    apiKey: settings.asiaex.api_key,
    data: 'J7o07v79ockengsEgGvovIKf1E5WFLm4yuB/JUYE+vI2K8Ha2HWNLdj1qOL7mH83na1UyQ18I/WOf5hXRfJi6Y/dJySKrRjVi/SMCqwLLACVni2IiWQXM/3/pxEbTmWqTk7KdKwLG+vtRs7KS7c5LNhSTsXQAFWtTeP2zzjV1SY='
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

router.post('/userCapitalCus', (req, res, next) => {
  let post_body = {
    secretKey: settings.asiaex.secret_key
  }
  signature.asiaex(post_body, (cb) => {
    console.log(cb);
    let post_data = {
      apiKey: settings.asiaex.api_key,
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

module.exports = router;