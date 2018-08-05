var request = require('request');
var signature = require('../utils/signature');
var settings = require('../settings');
var log4js = require('log4js');
log4js.configure(settings.log4js);
var logger = log4js.getLogger('balance');
var async = require('async');

let currency_arr = ["usdt", "btc"];
let market = 'usdt_btc';
let deal_count = 0.03;

// setInterval(intervalFunc, 1000 * 60 * 2);

// function intervalFunc() {
logger.info("开始运行 ===>");
dealOrder((cb) => {
  logger.info("本次运行结束 ===> " + JSON.stringify(cb));
})
// }


function dealOrder(deal_cb) {
  var result = {};
  async.waterfall([
    // 获取合适价格
    function (callback) {
      getMatchPrice((price) => {
        if (price.success) {
          result.price = price.price;
          callback(null, price.price);
        } else {
          callback('未匹配到合适价格');
        }
      })
    },
    // 查询操作用户
    function (price, callback) {
      queryDealUser((user_cb) => {
        if (user_cb.user) {
          result.buy = user_cb.user;
          callback(null, user_cb.user, price)
        } else {
          callback('用户余额异常');
        }
      })
    },
    function (user, price, callback) {
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
            callback("buy_error", err);
          } else {
            if (buy_body.code == 0) {
              result.buy_id = buy_body.order_id;
              result.buyer = user;
              callback(null, user, price);
            } else {
              callback("buy_error", buy_body);
            }
          }
        })
      })
    },
    function (user, price, callback) {
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
        request(sell_options, (error, buy_response, sell_body) => {
          if (error) {
            callback("sell_error", error);
          } else {
            if (sell_body.code == 0) {
              result.sell_id = sell_body.order_id;
              result.seller = user;
              callback(null, user, price);
            } else {
              callback("sell_error", sell_body);
            }
          }
        })
      })
    },
    // 查询订单状态
    function (callback) {
      if (result.sell_id && result.buy_id && result.seller && result.buyer) {
        async.parallel([
          function (ret_cb) {
            queryOrder(result.buyer, result.buy_id, (buy_order_cb) => {
              if (buy_order_cb.status != 2) {
                cancelOrder(result.buyer, result.buy_id, (cancel_buy_cb) => {
                  result.cancel_buy = result.buy_id;
                  ret_cb(null, cancel_buy_cb);
                })
              } else {
                ret_cb(null, buy_order_cb);
              }
            })
          },
          function (ret_cb) {
            queryOrder(result.seller, result.sell_id, (sell_order_cb) => {
              if (sell_order_cb.status != 2) {
                cancelOrder(result.seller, result.sell_id, (cancel_sell_cb) => {
                  result.cancel_sell = result.sell_id;
                  ret_cb(null, cancel_sell_cb);
                })
              } else {
                ret_cb(null, sell_order_cb);
              }
            })
          }
        ], function (ret_error, ret) {
          callback(null, ret);
        })
      }
    }
  ], function (error, results) {
    if (error) {
      deal_cb({
        success: false,
        msg: error
      })
    } else {
      deal_cb({
        success: true,
        msg: result
      });
    }
  })
}

function getMatchPrice(price_cb) {
  var currTime = Date.now() / 1000;
  async.waterfall([
    function (callback) {
      var paire_param = {
        apiKey: settings.digifinex[0].access_id,
        apiSecret: settings.digifinex[0].secret_key,
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
        apiKey: settings.digifinex[1].access_id,
        apiSecret: settings.digifinex[1].secret_key,
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

function queryOrder(user, order_id, cb) {
  var currTime = Date.now() / 1000;
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
        cb({});
      } else {
        cb({
          status: body.status,
          type: body.type,
          order_id: order_id
        });
      }
    })
  })
}

function cancelOrder(user, order_id, cb) {
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
      cb(sell_body);
    })
  })
}

function queryDealUser(cb) {
  async.map(settings.digifinex, function (user, callback) {
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
        callback(null, balance);
      })
    })
  }, function (error, result) {
    console.log("result ===> " + JSON.stringify(result));
    if (error) {

    } else {
      var user_a = result[0];
      console.log(JSON.stringify(user_a));
      var user_b = result[1];
      console.log(JSON.stringify(user_a));
      if (user_a[0].market == 'usdt' && user_a[0].free > 300 && user_b[1].market == 'btc' && user_b[1].free > deal_count) {
        cb({
          user: 0,
          info: {
            buy: user_a,
            sell: user_b
          }
        })
      } else if (user_a[1].market == 'usdt' && user_a[1].free > 300 && user_b[0].market == 'btc' && user_b[0].free > deal_count) {
        cb({
          user: 1,
          info: {
            buy: user_b,
            sell: user_a
          }
        })
      } else {
        cb({
          info: {
            buy: user_b,
            sell: user_a
          }
        })
      }
    }
  })
}