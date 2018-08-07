var request = require('request');
var signature = require('../utils/signature');
var settings = require('../settings');
var log4js = require('log4js');
log4js.configure(settings.log4js);
var logger = log4js.getLogger('balance');
var async = require('async');

let API_URI = 'https://www.coinall.com';
let MIN_AMOUNT = 0.0001;
let currency_arr = ["USDT", "OKB"];
let market = 'OKB-USDT';
let deal_count = 300;
let deal_usdt = 1000;

// setInterval(intervalFunc, 1000 * 60 * 1);

// function intervalFunc() {
logger.info("开始运行 ===>");
dealOrder((cb) => {
  logger.info("本次运行结束 ===> " + JSON.stringify(cb));
})
// }


function dealOrder(deal_cb) {
  var result = {};
  async.waterfall([
    //取消所有冻结的订单
    function (callback) {
      async.map([0, 1], function (user, cancel_callback) {
        cancelOpenOrder(user, (cancel) => {
          cancel_callback(null, cancel);
        })
      }, function (error, results) {
        logger.info('取消锁定的订单 ===> ' + JSON.stringify(results));
        callback(null);
      })
    },
    // 获取合适价格
    function (callback) {
      getMatchPrice((price) => {
        logger.info("price ===> " + JSON.stringify(price));
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
        logger.info("deal user ===> " + JSON.stringify(user_cb));
        var user = user_cb["user"];
        if (user == 0 || user == 1) {
          result.first_buy = user;
          callback(null, user, price)
        } else {
          callback('用户余额异常');
        }
      })
    },
    function (user, price, callback) {
      limitOrder(user, 'buy', price, deal_count, (buy_cb) => {
        callback(null, user, price);
      })
    },
    function (user, price, callback) {
      // 如果成功，马上换另一个用户挂卖单
      user = user == settings.coinall.length - 1 ? 0 : parseInt(user) + 1;
      limitOrder(user, 'sell', price, deal_count, (sell_cb) => {
        callback(null, user, price);
      })
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
  let currTime = Date.now() / 1000;
  var path = '/api/spot/v3/products/' + market + '/book?size=10';
  signature.coinall(currTime, 'GET', path, settings.coinall[0].secret_key, '', false, (sign) => {
    var options = {
      url: API_URI + path,
      headers: {
        'OK-ACCESS-KEY': settings.coinall[0].access_id,
        'OK-ACCESS-SIGN': sign.signature,
        'OK-ACCESS-TIMESTAMP': currTime,
        'OK-ACCESS-PASSPHRASE': settings.coinall[0].Passphrase
      },
      method: 'GET',
      json: true
    }
    request(options, (err, response, body) => {
      if (err) {
        price_cb({
          success: false
        })
      } else {
        var min_sell = parseFloat(body.asks[0][0]);
        var max_buy = parseFloat(body.bids[0][0]);
        var sub = parseFloat(min_sell - max_buy);
        if (sub > 2 * MIN_AMOUNT) {
          var price = (max_buy + sub / 2).toFixed(4);
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

function limitOrder(user, type, price, amount, order_cb) {
  let currTime = Date.now() / 1000;
  let params = {
    product_id: market,
    type: 'limit', // 	limit or market
    side: type, // buy or sell
    size: amount,
    price: price
  }
  let path = '/api/spot/v3/orders';
  signature.coinall(currTime, 'POST', path, settings.coinall[user].secret_key, params, true, (cb) => {
    var options = {
      url: API_URI + path,
      headers: {
        'OK-ACCESS-KEY': settings.coinall[user].access_id,
        'OK-ACCESS-SIGN': cb.signature,
        'OK-ACCESS-TIMESTAMP': currTime,
        'OK-ACCESS-PASSPHRASE': settings.coinall[user].Passphrase
      },
      method: 'POST',
      json: true,
      body: params
    }
    request(options, (err, response, order_body) => {
      logger.info("limitOrder ===> " + JSON.stringify(order_body));
      if (err) {
        order_cb(err);
      } else {
        if (order_body.result) {
          order_cb(order_body);
        } else {
          order_cb(order_body);
        }
      }
    })
  })
}

function marketOrder(user, type, amount, order_cb) {
  let currTime = Date.now() / 1000;
  let params = {
    product_id: market,
    type: 'market', // 	limit or market
    side: type, // buy or sell
  }
  if (type == 'buy') {
    params.funds = amount;
  } else if (type == 'sell') {
    params.size = amount;
  }
  logger.info("marketOrder params ===>" + JSON.stringify(params));
  let path = '/api/spot/v3/orders';
  signature.coinall(currTime, 'POST', path, settings.coinall[user].secret_key, params, true, (cb) => {
    var options = {
      url: API_URI + path,
      headers: {
        'OK-ACCESS-KEY': settings.coinall[0].access_id,
        'OK-ACCESS-SIGN': cb.signature,
        'OK-ACCESS-TIMESTAMP': currTime,
        'OK-ACCESS-PASSPHRASE': settings.coinall[0].Passphrase
      },
      method: 'POST',
      json: true,
      body: params
    }
    request(options, (err, response, order_body) => {
      logger.info("marketOrder ===> " + JSON.stringify(order_body));
      if (err) {
        order_cb({});
      } else {
        if (order_body.code == 0) {
          if (type == 'sell') {
            order_cb({
              user: user
            });
          } else if (type == 'buy') {
            order_cb({
              user: user == settings.digifinex.length - 1 ? 0 : user + 1
            });
          }

        } else {
          order_cb({});
        }
      }
    })
  })
}

function cancelOrder(user, order_id, cb) {
  let currTime = Date.now() / 1000;
  let params = {
    product_id: market,
  }
  let path = '/api/spot/v3/orders/' + order_id;
  signature.coinall(currTime, 'DELETE', path, settings.coinall[user].secret_key, params, true, (cb) => {
    let options = {
      url: API_URI + path,
      headers: {
        'OK-ACCESS-KEY': settings.coinall[user].access_id,
        'OK-ACCESS-SIGN': cb.signature,
        'OK-ACCESS-TIMESTAMP': currTime,
        'OK-ACCESS-PASSPHRASE': settings.coinall[user].Passphrase
      },
      method: 'DELETE',
      json: true,
      body: params
    }
    request(options, (error, buy_response, body) => {
      cb(body);
    })
  })
}

function queryDealUser(cb) {
  async.map(settings.coinall, function (user, callback) {
    let currTime = Date.now() / 1000;
    var path = '/api/spot/v3/accounts';
    signature.coinall(currTime, 'GET', path, user.secret_key, '', false, (cb) => {
      console.log(JSON.stringify(cb));
      var options = {
        url: API_URI + path,
        headers: {
          'OK-ACCESS-KEY': user.access_id,
          'OK-ACCESS-SIGN': cb.signature,
          'OK-ACCESS-TIMESTAMP': currTime,
          'OK-ACCESS-PASSPHRASE': user.Passphrase
        },
        method: 'GET',
        json: true
      }
      request(options, (err, response, body) => {
        if (err) {
          logger.info("myposition error ===> " + JSON.stringify(err));
          callback('查询余额失败', null);
        } else {
          logger.info("myposition ===> " + JSON.stringify(body));
          var balance = [];
          body.forEach(currency => {
            if (currency.currency != null && (currency.currency == currency_arr[0] || currency.currency == currency_arr[1])) {
              balance.push({
                market: currency.currency,
                free: currency.available,
                frozen: currency.holds
              })
            }
          })
          callback(null, balance);
        }
      })
    })
  }, function (error, result) {
    logger.info("user balance ===> " + JSON.stringify(result));
    if (error) {
      cb({});
    } else {
      var user_a = result[0];
      var user_b = result[1];
      var user_a_usdt = parseFloat(user_a[0].free);
      var user_a_okb = parseFloat(user_a[1].free);
      var user_b_usdt = parseFloat(user_b[0].free);
      var user_b_okb = parseFloat(user_b[1].free);
      if (user_a_usdt > deal_usdt && user_b_okb >= deal_count) {
        cb({
          user: 0
        })
      } else if (user_b_usdt > deal_usdt && user_a_okb >= deal_count) {
        cb({
          user: 1
        })
      } else {
        if (user_a_okb > deal_count || user_b_okb > deal_count) {
          let sell_user = 0;
          if (user_a_okb < user_b_okb) {
            // 卖掉b的0.03 okb
            sell_user = 1;
          }
          marketOrder(sell_user, 'sell', deal_count, (order_cb) => {
            cb(order_cb);
          })
        } else if (user_a_usdt > deal_usdt || user_b_usdt > deal_usdt) {
          let buy_user = 0;
          if (user_b_usdt > user_a_usdt) {
            buy_user = 1;
          }
          marketOrder(buy_user, 'buy', deal_count, (order_cb) => {
            cb(order_cb);
          })
        } else if (user_a_okb < deal_count && user_a_usdt < deal_usdt && user_b_okb < deal_count && user_b_usdt < deal_usdt) {
          var sell_user = 0;
          var buy_user = 1;
          if (user_a_okb > user_b_okb) {
            sell_user = 1;
            buy_user = 0;
          }
          // a 用户okb较多，a保留okb，b保留usdt
          async.parallel([
            // a 把usdt换成okb,买入okb
            function (change_cb) {
              marketOrder(buy_user, 'buy', deal_count - user_a_okb, (market_change_cb) => {
                if (market_change_cb != null && market_change_cb.user != null) {
                  change_cb(null, market_change_cb);
                } else {
                  change_cb('market_change_cb buy error', market_change_cb);
                }
              })
            },
            // b 把okb换成usdt,卖出okb
            function (change_cb) {
              marketOrder(sell_user, 'sell', 0.0002, (market_change_cb) => {
                if (market_change_cb != null && market_change_cb.user != null) {
                  change_cb(null, market_change_cb);
                } else {
                  change_cb('market_change_cb sell error', market_change_cb);
                }
              });
            }
          ], function (change_err, change_results) {
            cb(change_results[0]);
          })
        } else {
          cb({});
        }
      }
    }
  })
}

function cancelOpenOrder(user, cancel_cb) {
  let currTime = Date.now() / 1000;
  let path = '/api/spot/v3/orders_pending';
  signature.coinall(currTime, 'GET', path, settings.coinall[user].secret_key, '', false, (sign) => {
    let options = {
      url: API_URI + path,
      headers: {
        'OK-ACCESS-KEY': settings.coinall[user].access_id,
        'OK-ACCESS-SIGN': sign.signature,
        'OK-ACCESS-TIMESTAMP': currTime,
        'OK-ACCESS-PASSPHRASE': settings.coinall[user].Passphrase
      },
      method: 'GET',
      json: true
    }
    request(options, (error, buy_response, body) => {
      if (error) {
        logger.info("open_orders error ===> " + JSON.stringify(error));
        cancel_cb({});
      } else {
        logger.info("open_orders ===> " + JSON.stringify(body));
        if (body.length > 0) {
          async.map(body, function (order, callback) {
            cancelOrder(user, order.order_id, (cancel) => {
              logger.info(order.order_id + " cancel ===> " + JSON.stringify(cancel));
              callback(null, cancel);
            });
          }, function (err, results) {
            cancel_cb(results);
          })
        } else {
          cancel_cb({})
        }
      }
    })
  })
}