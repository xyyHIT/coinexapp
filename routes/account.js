var express = require('express');
var router = express.Router();
var request = require('request');
var signature = require('../utils/signature');
var settings = require('../settings');


router.get('/', function(req, res, next) {
  let currTime = Date.now();
  var str = "access_id="+settings.access_id+"&tonce="+currTime;
  signature.signature(str, false, function(cb) {
    console.log("cb ===>" + JSON.stringify(cb));
    let options = {
      url: 'https://api.coinex.com/v1/balance/info',
      headers: {
        authorization: cb.signature
      },
      qs: {
        access_id: settings.access_id,
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

module.exports = router;