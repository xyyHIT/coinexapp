var express = require('express');
var router = express.Router();
var request = require('request');
var signature = require('../utils/signature');
var settings = require('../settings');
var async = require('async');

var currency_arr = ["usdt", "btc", "bch", "eth"];

router.get('/ticker', (req, res, next) => {
  var currTime = Date.now() / 1000;
  var params = {
    apiKey: settings.digifinex[0].access_id,
    apiSecret: settings.digifinex[0].secret_key,
    timestamp: currTime
  }
  signature.digifinex(params, (signature) => {
    params.sign = signature.signature
    var options = {
      url: 'https://openapi.digifinex.com/v2/ticker',
      method: 'get',
      json: true,
      qs: params
    }
    request(options, (err, response, body) => {
      if (err) {

      } else {
        res.json(body);
      }
    })
  })

})

router.get('/myBalance', (req, res, next) => {
  async.mapSeries(settings.digifinex, function (user, callback) {
      queryBalance(user, (balance_cb) => {
        callback(null, balance_cb);
      })
    },
    function (error, results) {
      res.json(results);
    })
})

function queryBalance(user, balance_cb) {
  let currTime = Date.now() / 1000;
  var params = {
    apiKey: user.access_id,
    apiSecret: user.secret_key,
    timestamp: currTime
  }
  signature.digifinex(params, (cb) => {
    params.sign = cb.signature;
    let options = {
      url: 'https://openapi.digifinex.com/v2/myposition',
      method: 'get',
      json: true,
      qs: params
    }
    request(options, (err, response, body) => {
      var balance = [];
      currency_arr.forEach(currency => {
        balance.push({
          market: currency,
          free: body.free[currency] == null ? 0 : body.free[currency],
          frozen: body.frozen[currency] == null ? 0 : body.frozen[currency]
        })
      })
      balance_cb(balance);
    })
  })
}

router.post('/placeOrder', (req, res, next) => {
  var market = req.body.market;
  var user = req.body.user;
  async.waterfall([
    // 获取合适价格
    function (callback) {
      getMatchPrice(user, market, (price) => {
        if (price.success) {
          callback(null, price.price);
        } else {
          callback('未匹配到合适价格');
        }
      })
    },
    function (price, callback) {
      let currTime = parseInt(Date.now() / 1000);
      let deal_count = (req.body.amount * 0.99).toFixed(4);
      // 先挂买单
      let post_buy = {
        amount: deal_count, //下单数量 
        apiKey: settings.digifinex[user].access_id,
        apiSecret: settings.digifinex[user].secret_key,
        price: price,
        symbol: market,
        timestamp: currTime,
        type: 'buy'
      }
      var result = '[price=' + price + "]";
      signature.digifinex(post_buy, (cb) => {
        post_buy.sign = cb.signature;
        let post_options = {
          url: 'https://openapi.digifinex.com/v2/trade',
          method: 'post',
          json: true,
          form: post_buy
        }
        request(post_options, (err, response, buy_body) => {
          console.log("buy_body ===> " + JSON.stringify(buy_body));
          if (err) {
            callback("[委托买入失败]" + err, null);
          } else {
            if (buy_body.code == 0) {
              result += "[买入" + buy_body.order_id + "]";
              // 如果成功，马上换另一个用户挂卖单
              user = user == settings.digifinex.length - 1 ? 0 : parseInt(user) + 1;
              let post_sell = {
                apiKey: settings.digifinex[user].access_id,
                apiSecret: settings.digifinex[user].secret_key,
                amount: deal_count, //下单数量 
                timestamp: currTime,
                price: price,
                symbol: market,
                tradeType: 'sell'
              }
              signature.digifinex(post_sell, (sign) => {
                post_sell.sign = sign.signature;
                let sell_options = {
                  url: 'https://openapi.digifinex.com/v2/trade',
                  method: 'post',
                  json: true,
                  form: post_sell
                }
                request(sell_options, (error, buy_response, sell_body) => {
                  console.log("sell_body ===> " + JSON.stringify(sell_body));
                  if (error) {
                    callback(result + " [委托卖出失败]" + error, null);
                  } else {
                    if (sell_body.code == 0) {
                      callback(null, result + " [卖出" + sell_body.order_id + "] ");
                    } else {
                      callback(result + " [委托卖出失败]", null);
                    }
                  }
                })
              })
            } else {
              callback(buy_body, null);
            }
          }
        })
      })
    }
  ], function (error, results) {
    if (error) {
      res.json({
        success: false,
        msg: error
      })
    } else {
      res.json({
        success: true,
        msg: results
      });
    }

  })
})

function getMatchPrice(user, market, price_cb) {
  var currTime = Date.now() / 1000;
  var params = {
    apiKey: settings.digifinex[user].access_id,
    apiSecret: settings.digifinex[user].secret_key,
    symbol: market,
    timestamp: currTime
  }
  signature.digifinex(params, (signature) => {
    params.sign = signature.signature
    var options = {
      url: 'https://openapi.digifinex.com/v2/depth',
      method: 'get',
      json: true,
      qs: params
    }
    request(options, (err, response, body) => {
      if (err) {
        price_cb({
          success: false
        })
      } else {
        var min_sell = body.asks[body.asks.length - 1][0];
        var max_buy = body.bids[body.bids.length - 1][0];
        var sub = min_sell - max_buy;
        if (sub > 0.02) {
          var price = max_buy + parseFloat((sub / 2).toFixed(2));
          console.log(min_sell + " " + price + " " + max_buy);
          price_cb({
            success: true,
            price: price
          })
        } else {
          price_cb({
            success: false
          })
        }
      }
    })
  })

}

module.exports = router;