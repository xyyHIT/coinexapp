var express = require('express');
var router = express.Router();
var request = require('request');
var signature = require('../utils/signature');
var settings = require('../settings');
var async = require('async');

var currency_arr = ["usdt", "btc"];

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

router.get('/queryOrder', (req, res, next) => {
  var currTime = Date.now() / 1000;
  var user = req.query.user;
  var order_id = req.query.order_id;
  var params = {
    apiKey: settings.digifinex[user].access_id,
    apiSecret: settings.digifinex[user].secret_key,
    order_id: order_id,
    timestamp: currTime
  }
  signature.digifinex(params, (signature) => {
    params.sign = signature.signature
    var options = {
      url: 'https://openapi.digifinex.com/v2/order_detail',
      method: 'get',
      json: true,
      qs: params
    }
    request(options, (err, response, body) => {
      if (err) {
        res.json({});
      } else {
        res.json({
          status: body.status,
          type: body.type,
          order_id: order_id
        });
      }
    })
  })
})


router.get('/trade_pairs', (req, res, next) => {
  var currTime = Date.now() / 1000;
  var user = req.query.user;
  var params = {
    apiKey: settings.digifinex[user].access_id,
    apiSecret: settings.digifinex[user].secret_key,
    timestamp: currTime
  }
  signature.digifinex(params, (signature) => {
    params.sign = signature.signature
    var options = {
      url: 'https://openapi.digifinex.com/v2/trade_pairs',
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

router.get('/limitOrder', (req, res, next) => {
  let user = req.query.user;
  let price = parseFloat(req.query.price);
  let amount = parseFloat(req.query.amount).toFixed(4);
  let type = req.query.type;
  let currTime = parseInt(Date.now() / 1000);
  let post_sell = {
    amount: amount, //下单数量 
    apiKey: settings.digifinex[user].access_id,
    apiSecret: settings.digifinex[user].secret_key,
    price: price,
    symbol: 'usdt_btc',
    timestamp: currTime,
    type: type
  }

  signature.digifinex(post_sell, (sign) => {
    post_sell.sign = sign.signature;
    let sell_options = {
      url: 'https://openapi.digifinex.com/v2/trade',
      method: 'post',
      json: true,
      form: post_sell
    }
    console.log(JSON.stringify(post_sell));
    request(sell_options, (error, buy_response, sell_body) => {
      res.json(sell_body);
    })
  })
})


router.get('/cancelOrder', (req, res, next) => {
  let user = req.query.user;
  let order_id = req.query.order_id;
  let currTime = parseInt(Date.now() / 1000);
  let post_body = {
    apiKey: settings.digifinex[user].access_id,
    apiSecret: settings.digifinex[user].secret_key,
    order_id: order_id,
    timestamp: currTime
  }

  signature.digifinex(post_body, (sign) => {
    post_body.sign = sign.signature;
    let options = {
      url: 'https://openapi.digifinex.com/v2/cancel_order',
      method: 'post',
      json: true,
      form: post_body
    }
    request(options, (error, buy_response, sell_body) => {
      res.json(sell_body);
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
        if (body.free) {
          balance.push({
            market: currency,
            free: body.free[currency] == null ? 0 : body.free[currency],
            frozen: body.frozen[currency] == null ? 0 : body.frozen[currency]
          })
        }
      })
      balance_cb(balance);
    })
  })
}

router.post('/placeOrder', (req, res, next) => {
  var market = req.body.market;
  var user = req.body.user;
  let deal_count = req.body.amount;
  var result = '';
  async.waterfall([
    // 获取合适价格
    function (callback) {
      getMatchPrice(user, market, (price) => {
        if (price.success) {
          result = '[price=' + price.price + "]";
          callback(null, price.price);
        } else {
          callback('未匹配到合适价格');
        }
      })
    },
    function (price, callback) {
      let currTime = parseInt(Date.now() / 1000);
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
      signature.digifinex(post_buy, (cb) => {
        post_buy.sign = cb.signature;
        let post_options = {
          url: 'https://openapi.digifinex.com/v2/trade',
          method: 'post',
          json: true,
          form: post_buy
        }
        //console.log("post_buy ===> " + JSON.stringify(post_buy));
        request(post_options, (err, response, buy_body) => {
          //console.log("buy_body ===> " + JSON.stringify(buy_body));
          if (err) {
            callback("[委托买入失败]" + err, null);
          } else {
            if (buy_body.code == 0) {
              result += "[买入" + buy_body.order_id + "]";
              callback(null, price);
            } else {
              callback(buy_body, null);
            }
          }
        })
      })
    },
    function (price, callback) {
      // 如果成功，马上换另一个用户挂卖单
      user = user == settings.digifinex.length - 1 ? 0 : parseInt(user) + 1;
      var nowTime = parseInt(Date.now() / 1000);
      let post_sell = {
        amount: deal_count, //下单数量 
        apiKey: settings.digifinex[user].access_id,
        apiSecret: settings.digifinex[user].secret_key,
        price: price,
        symbol: market,
        timestamp: nowTime,
        type: 'sell'
      }
      signature.digifinex(post_sell, (sign) => {
        post_sell.sign = sign.signature;
        let sell_options = {
          url: 'https://openapi.digifinex.com/v2/trade',
          method: 'post',
          json: true,
          form: post_sell
        }
        //console.log("post_sell ===> " + JSON.stringify(post_sell));
        request(sell_options, (error, buy_response, sell_body) => {
          //console.log("sell_body ===> " + JSON.stringify(sell_body));
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
  async.waterfall([
    function (callback) {
      var paire_param = {
        apiKey: settings.digifinex[user].access_id,
        apiSecret: settings.digifinex[user].secret_key,
        timestamp: currTime
      }
      signature.digifinex(paire_param, (signature) => {
        paire_param.sign = signature.signature
        var options = {
          url: 'https://openapi.digifinex.com/v2/trade_pairs',
          method: 'get',
          json: true,
          qs: paire_param
        }
        request(options, (err, response, body) => {
          if (err) {

          } else {
            callback(null, body.data[market]);
          }
        })
      })
    },
    function (paire, callback) {
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
            if (sub > 2 * Math.pow(10, (-1) * paire[1])) {
              var price = parseFloat(max_buy + sub / 2).toFixed(parseInt(paire[1]));
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
  ], function (error, results) {

  })


}

module.exports = router;