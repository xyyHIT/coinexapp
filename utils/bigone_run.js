var request = require('request');
var signature = require('../utils/signature');
var settings = require('../settings');
var log4js = require('log4js');
log4js.configure(settings.log4js);
var logger = log4js.getLogger('balance');
var async = require('async');

let currency_arr = ["USDT", "ONE"];
let market = 'ONE-USDT';
let market_id = '19240bdc-4fa1-47db-9dba-c3f6dbf22087';
let deal_count = 0.02;
let deal_usdt = 200;
let API_URI = 'https://big.one/api/v2';

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
    // 取消所有冻结的订单
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
      limitOrder(user, 'buy', price, deal_count, (buy_body) => {
        logger.info("buy_body ===> " + JSON.stringify(buy_body));
        callback(null, user, price);
      })
    },
    function (user, price, callback) {
      // 如果成功，马上换另一个用户挂卖单
      user = user == settings.bigone.length - 1 ? 0 : parseInt(user) + 1;
      limitOrder(user, 'sell', price, deal_count, (sell_body) => {
        logger.info("shell_body ===> " + JSON.stringify(sell_body));
        callback(null, sell_body);
      })

    },
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
  signature.bigone(settings.bigone[0].access_id, settings.bigone[0].secret_key, (cb) => {
    console.log(JSON.stringify(cb));
    let options = {
      url: API_URI + '/markets/' + market + '/depth',
      method: 'get',
      headers: {
        Authorization: "Bearer " + cb.signature
      },
      json: true
    }
    request(options, (err, response, body) => {
      if (err) {
        price_cb({
          success: false
        })
      } else {
        var min_sell = body.asks[0][0];
        var max_buy = body.bids[0][0];
        var sub = min_sell - max_buy;
        if (sub > 2 * 0.00001) {
          var price = parseFloat(max_buy + sub / 2).toFixed(5);
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
  let side = 'BID';
  if (type == 'sell') {
    side = 'ASK';
  }
  signature.bigone(settings.bigone[user].access_id, settings.bigone[user].secret_key, (cb) => {
    console.log(JSON.stringify(cb));
    let options = {
      url: API_URI + '/markets/' + market + '/depth',
      method: 'post',
      headers: {
        Authorization: "Bearer " + cb.signature
      },
      json: true,
      form: {
        market_id: market_id,
        side: side,
        price: price,
        amount: amount
      }
    }
    request(options, (err, response, order_body) => {
      logger.info("post_order ===> " + JSON.stringify(order_body));
      if (err) {
        order_cb(err);
      } else {
        if (order_body.code == 0) {
          order_cb(order_body);
        } else {
          order_cb(order_body);
        }
      }
    })
  })
}

function cancelOrder(user, order_id, cb) {
  signature.bigone(settings.bigone[user].access_id, settings.bigone[user].secret_key, (cb) => {
    console.log(JSON.stringify(cb));
    let options = {
      url: API_URI + '/viewer/orders/' + order_id + '/cancel',
      method: 'post',
      headers: {
        Authorization: "Bearer " + cb.signature
      },
      json: true,
      form: {
        order_id: order_id
      }
    }
    request(options, (err, response, sell_body) => {
      cb(sell_body);
    })
  })
}

function queryDealUser(cb) {
  async.map(settings.bigone, function (user, callback) {
    signature.bigone(user.access_id, user.secret_key, (cb) => {
      console.log(JSON.stringify(cb));
      let options = {
        url: API_URI + '/viewer/accounts',
        method: 'get',
        headers: {
          Authorization: "Bearer " + cb.signature
        },
        json: true
      }
      request(options, (err, response, body) => {
        if (err) {

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
      var user_a_one = parseFloat(user_a[1].free);
      var user_b_usdt = parseFloat(user_b[0].free);
      var user_b_one = parseFloat(user_b[1].free);
      if (user_a_usdt > deal_usdt && user_b_one >= deal_count) {
        cb({
          user: 0
        })
      } else if (user_b_usdt > deal_usdt && user_a_one >= deal_count) {
        cb({
          user: 1
        })
      } else {
        if (user_a_one > deal_count || user_b_one > deal_count) {
          let sell_user = 0;
          if (user_a_one < user_b_one) {
            // 卖掉b的0.03 btc
            sell_user = 1;
          }
          changeBalance(sell_user, 'sell', deal_count, (market_change_cb) => {
            cb(market_change_cb);
          });
        } else if (user_a_usdt > deal_usdt || user_b_usdt > deal_usdt) {
          let buy_user = 0;
          if (user_b_usdt > user_a_usdt) {
            buy_user = 1;
          }
          changeBalance(buy_user, 'buy', deal_count, (market_change_cb) => {
            cb(market_change_cb);
          });
        } else {
          var sell_user = 0; // 要卖出btc的账户
          var buy_user = 1; // 要买入btc的账户
          var sell_btc = user_a_one;
          var buy_btc = deal_count - user_b_one;
          if (user_a_one > user_b_one) {
            sell_btc = Math.floor(user_b_one * 10000) / 10000
            buy_btc = Math.floor((deal_count - user_a_one) * 10000) / 10000
            sell_user = 1;
            buy_user = 0;
          }
          async.parallel([
            function (change_cb) {
              if (buy_btc > 0) {
                changeBalance(buy_user, 'buy', buy_btc, (market_change_cb) => {
                  if (market_change_cb != null && market_change_cb.user != null) {
                    change_cb(null, market_change_cb);
                  } else {
                    change_cb('market_change_cb buy error', market_change_cb);
                  }
                })
              } else {
                change_cb(null, {
                  user: sell_user
                });
              }
            },
            // b 把btc换成usdt,卖出btc
            function (change_cb) {
              if (sell_btc > 0) {
                changeBalance(sell_user, 'sell', sell_btc, (market_change_cb) => {
                  if (market_change_cb != null && market_change_cb.user != null) {
                    change_cb(null, market_change_cb);
                  } else {
                    change_cb('market_change_cb sell error', market_change_cb);
                  }
                })
              } else {
                change_cb(null, {
                  user: buy_user
                });
              }
            }
          ], function (change_err, change_results) {
            cb(change_results[0]);
          })
        }
      }
    }
  })
}

function queryNowPrice(user, type, amount, now_price_cb) {
  signature.bigone(settings.bigone[user].access_id, settings.bigone[user].secret_key, (cb) => {
    console.log(JSON.stringify(cb));
    let options = {
      url: API_URI + '/markets/' + market + '/depth',
      method: 'get',
      headers: {
        Authorization: "Bearer " + cb.signature
      },
      json: true
    }
    request(options, (err, response, body) => {
      if (err) {
        now_price_cb({});
      } else {
        if (type == 'buy') {
          // 从asks里面找
          let length = body.asks.length;
          var buy_price = 0;
          for (let index = 0; index < length; index++) {
            if (body.asks[index][2] > amount) {
              buy_price = body.asks[index][0];
              break;
            }
          }
          now_price_cb(buy_price);
        } else if (type == 'sell') {
          // 从bids里面找
          let length = body.bids.length;
          var sell_price = 0;
          for (let index = 0; index < length; index++) {
            if (body.bids[index][2] > amount) {
              sell_price = body.bids[index][0];
              break;
            }
          }
          now_price_cb(sell_price);
        }
      }
    })
  })

}

function cancelOpenOrder(user, cancel_cb) {
  signature.bigone(settings.bigone[user].access_id, settings.bigone[user].secret_key, (cb) => {
    let options = {
      url: API_URI + '/viewer/orders/cancel_all',
      method: 'post',
      headers: {
        Authorization: "Bearer " + cb.signature
      },
      json: true,
      form: {
        market_id: market_id
      }
    }
    request(options, (err, response, body) => {
      if (err) {
        cancel_cb({});
      } else {
        cancel_cb(body);
      }
    })
  })
}
// 查找合适的市场价交易
function changeBalance(user, type, amount, market_change_cb) {
  async.waterfall([
    function (market_order_cb) {
      queryNowPrice(user, type, amount, (now_price) => {
        logger.info(user + " " + type + " now_price ===> " + JSON.stringify(now_price));
        market_order_cb(null, now_price);
      })
    },
    function (now_price, market_order_cb) {
      if (now_price > 0) {
        limitOrder(user, type, now_price, amount, (order_cb) => {
          market_order_cb(null, order_cb);
        })
      } else {
        market_order_cb('没找到合适的买价', order_cb);
      }
    }
  ], function (err, buy_result) {
    logger.log("market_order result ===> " + JSON.stringify(buy_result));
    if (err) {
      market_change_cb({});
    } else {
      if (type == 'sell') {
        market_change_cb({
          user: user
        });
      } else if (type == 'buy') {
        market_change_cb({
          user: user == settings.bigone.length - 1 ? 0 : user + 1
        });
      }
    }
  })
}