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