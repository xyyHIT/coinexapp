var request = require('request');
var signature = require('../utils/signature');
var settings = require('../settings');
var log4js = require('log4js');
log4js.configure(settings.log4js);
var logger = log4js.getLogger(__filename);
var async = require('async');

// var json = {"userId":"u111","name":"zhangsan"};
// let currTime = Date.now();
// signature.zbg(currTime, json, true, function(cb) {
//   console.log(cb);
// })
chargeBalance({}, function (callback) {
  console.log(callback)
})

function chargeBalance(currCNY, callback) {
  currCNY = new Map();
  currCNY.set("BTC", "8110.33");
  currCNY.set("ETH", "473.874");
  currCNY.set("BCH", "863.257");
  currCNY.set("USDT", "0.996413");
  //1. 查询当前余额
  let currTime = Date.now();
  var str = "access_id=" + settings.coinex.access_id + "&tonce=" + currTime;
  signature.signature(str, false, function (cb) {
    let options = {
      url: 'https://api.coinex.com/v1/balance/info',
      headers: {
        authorization: cb.signature
      },
      qs: {
        access_id: settings.coinex.access_id,
        tonce: currTime
      },
      json: true,
    }
    request.get(options, (err, response, body) => {
      if (err) {
        logger.error(err);
      } else {
        logger.info(" inininini ===>" + JSON.stringify(body));
        var maxBalance = 0;
        var needChangeCount = 0;
        var maxCoin = null;
        for (let coin in body.data) {
          logger.info("let coin ===>" + coin);
          var balance = body.data[coin];

          if (coin == 'BTC') {
            let sum = parseFloat(balance.available * currCNY.get(coin));
            if (sum > maxBalance) {
              maxBalance = sum;
              maxCoin = {
                coin: 'CETBTC',
                total: sum
              }
              logger.info("max coin ===> " + maxCoin);
            }
            if (sum < 500) {
              needChangeCount += parseFloat(500 / currCNY.get(coin));
            }
          } else if (coin == 'BCH') {
            let sum = parseFloat(balance.available * currCNY.get(coin));
            if (sum > maxBalance) {
              maxBalance = sum;
              maxCoin = {
                coin: 'CETBCH',
                total: sum
              }
              logger.info("max coin ===> " + maxCoin);
            }
            if (sum < 500) {
              needChangeCount += parseFloat(500 / currCNY.get(coin));
            }
          } else if (coin == 'ETH') {
            let sum = parseFloat(balance.available * currCNY.get(coin));
            if (sum > maxBalance) {
              maxBalance = sum;
              maxCoin = {
                coin: 'CETETH',
                total: sum
              }
              logger.info("max coin ===> " + maxCoin);
            }
            if (sum < 500) {
              needChangeCount += parseFloat(500 / currCNY.get(coin));
            }
          } else if (coin == 'USDT') {
            let sum = parseFloat(balance.available * currCNY.get(coin));
            if (sum > maxBalance) {
              maxBalance = sum;
              maxCoin = {
                coin: 'CETUSDT',
                total: sum
              }
              logger.info("max coin ===> " + maxCoin);
            }
            if (sum < 500) {
              needChangeCount += parseFloat(500 / currCNY.get(coin));
            }
          }
        }
        logger.info(" maxCoinBalance ===> " + JSON.stringify(maxCoin));
        logger.info(" maxBalance ===> " + JSON.stringify(maxBalance));
        let sell_obj = {
          amount: String(needChangeCount),
          market: maxCoin.coin
        }
        logger.info(" sell_obj ===> " + JSON.stringify(sell_obj));
      }
    })
  })
}