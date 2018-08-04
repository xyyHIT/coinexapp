var request = require('request');
var signature = require('../utils/signature');
var settings = require('../settings');
var log4js = require('log4js');
log4js.configure(settings.log4js);
var logger = log4js.getLogger('balance');
var async = require('async');

var args = process.argv.splice(2);
console.log(args);

var user = parseInt(args[0]);

if (user) {
  setInterval(intervalFunc, 1000 * 60);
} else {
  console.log("参数错误");
}


function intervalFunc() {
  dealOrder((cb) => {
    logger.info("本次运行结束 ===> " + JSON.stringify(cb));
  })
}

let market = 'usdt_btc';
let deal_count = 0.03;

function dealOrder(deal_cb) {
  async.waterfall([
    // 获取合适价格
    function (callback) {
      getMatchPrice((price) => {
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
      deal_cb({
        success: false,
        msg: error
      })
    } else {
      user = user == settings.digifinex.length - 1 ? 0 : parseInt(user) + 1;
      deal_cb({
        success: true,
        msg: results
      });
    }
  })
}

function getMatchPrice(price_cb) {
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
              logger.info(min_sell + " " + price + " " + max_buy);
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