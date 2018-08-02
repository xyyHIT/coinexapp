var express = require('express');
var router = express.Router();
var request = require('request');
var signature = require('../utils/signature');
var settings = require('../settings');
var async = require('async');

var currency_arr = ["usdt", "btc", "bch", "eth"];

router.get('/market/symbols', (req, res, next) => {
  var options = {
    url: 'https://api.bitforex.com/api/v1/market/symbols',
    method: 'get',
    json: true
  }
  request(options, (err, response, body) => {
    if (err) {

    } else {
      res.json(body);
    }
  })
})

router.get('/fund/mainAccount', (req, res, next) => {
  let currTime = Date.now();
  var post_data = {
    accessKey: settings.bitforex[0].access_id,
    currency: req.query.currency,
    nonce: currTime
  }
  signature.bitforex(settings.bitforex[0].secret_key, '/api/v1/fund/mainAccount?', post_data, true, (cb) => {
    console.log(JSON.stringify(cb));
    let post_options = {
      url: 'https://api.bitforex.com' + cb.signature,
      method: 'post',
      json: true
    }
    request(post_options, (err, response, body) => {
      if (err) {

      } else {
        res.json(body);
      }
    })
  })
})

router.get('/myBalance', (req, res, next) => {
  async.mapSeries(settings.bitforex, function (user, callback) {
      queryBalance(user, (balance_cb) => {
        callback(null, balance_cb);
      })
    },
    function (error, results) {
      res.json(results);
    })
})

function queryBalance(user, balance_cb) {
  let currTime = Date.now();
  var post_data = {
    accessKey: user.access_id,
    nonce: currTime
  }
  signature.bitforex(user.secret_key, '/api/v1/fund/allAccount?', post_data, true, (cb) => {
    let post_options = {
      url: 'https://api.bitforex.com' + cb.signature,
      method: 'post',
      json: true
    }
    request(post_options, (err, response, body) => {
      console.log(JSON.stringify(body));
      var balance = [];
      for (let index in body.data) {
        var obj = body.data[index];
        if (obj.currency == 'btc') {
          balance.push({
            btc: {
              active: obj.active,
              frozen: obj.frozen
            }
          })
        } else if (obj.currency == 'usdt') {
          balance.push({
            usdt: {
              active: obj.active,
              frozen: obj.frozen
            }
          })
        } else if (obj.currency == 'eth') {
          balance.push({
            eth: {
              active: obj.active,
              frozen: obj.frozen
            }
          })
        } else if (obj.currency == 'bch') {
          balance.push({
            bth: {
              active: obj.active,
              frozen: obj.frozen
            }
          })
        }
      }
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
      getMatchPrice(market, (price) => {
        if (price.success) {
          callback(null, price.price);
        } else {
          callback('未匹配到合适价格');
        }
      })
    },
    function (price, callback) {
      let currTime = Date.now();
      let deal_count = req.body.amount * 0.99;
      // 先挂买单
      let post_buy = {
        accessKey: settings.bitforex[user].access_id,
        amount: deal_count, //下单数量 
        nonce: currTime,
        price: price,
        symbol: market,
        tradeType: 1 //买卖类型：1、买入，2、卖出
      }
      var result = '';
      signature.bitforex(settings.bitforex[user].secret_key, '/api/v1/trade/placeOrder?', post_buy, true, (cb) => {
        let post_options = {
          url: 'https://api.bitforex.com' + cb.signature,
          method: 'post',
          json: true
        }
        request(post_options, (err, response, buy_body) => {
          console.log("buy_body ===> " + JSON.stringify(buy_body));
          if (err) {
            callback("[委托买入失败]" + err, null);
          } else {
            if (buy_body.success) {
              result += "[买入" + buy_body.data.orderId + "]";
              // 如果成功，马上换另一个用户挂卖单
              user = user == settings.bitforex.length - 1 ? 0 : parseInt(user) + 1;
              let post_sell = {
                accessKey: settings.bitforex[user].access_id,
                amount: deal_count, //下单数量 
                nonce: currTime,
                price: price,
                symbol: market,
                tradeType: 2 //1、买入，2、卖出
              }
              signature.bitforex(settings.bitforex[user].secret_key, '/api/v1/trade/placeOrder?', post_sell, true, (sign) => {
                let sell_options = {
                  url: 'https://api.bitforex.com' + sign.signature,
                  method: 'post',
                  json: true
                }
                request(sell_options, (error, buy_response, sell_body) => {
                  console.log("sell_body ===> " + JSON.stringify(sell_body));
                  if (error) {
                    callback(result + " [委托卖出失败]" + error, null);
                  } else {
                    if (sell_body.success) {
                      callback(null, result + " [卖出" + buy_body.data.orderId + "] ");
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

function getMatchPrice(market, price_cb) {
  let options = {
    url: 'https://api.bitforex.com/api/v1/market/ticker?symbol=' + market,
    method: 'get',
    json: true,
  }
  request(options, (err, response, body) => {
    if (err) {
      price_cb({
        success: false
      })
    } else {
      var min_sell = body.data.sell;
      var max_buy = body.data.buy;
      var sub = min_sell - max_buy;
      if (sub > 0) {
        var price = max_buy + parseFloat((sub / 2).toFixed(4));
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
}

module.exports = router;