var request = require('request');
var signature = require('../utils/signature');
var settings = require('../settings');
var log4js = require('log4js');
log4js.configure(settings.log4js);
var logger = log4js.getLogger('balance');
var async = require('async');

let currency_arr = ["usdt", "btc"];
let market = 'usdt_btc';
let deal_count = 0.02;
let deal_usdt = 200;

setInterval(intervalFunc, 1000 * 60 * 2);

function intervalFunc() {
  logger.info("开始运行 ===>");
  dealOrder((cb) => {
    logger.info("本次运行结束 ===> " + JSON.stringify(cb));
  })
}


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
          logger.info("buy_body ===> " + JSON.stringify(buy_body));
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
          logger.info("sell_body ===> " + JSON.stringify(sell_body));
          if (error) {
            callback("sell_error", error);
          } else {
            if (sell_body.code == 0) {
              result.sell_id = sell_body.order_id;
              result.seller = user;
              callback(null, sell_body);
            } else {
              callback("sell_error", sell_body);
            }
          }
        })
      })
    },
    // 查询订单状态
    // function (sell_body, callback) {
    //   logger.info("result ===> " + JSON.stringify(result));
    //   if (result.sell_id != null && result.buy_id != null && result.seller != null && result.buyer != null) {
    //     async.parallel([
    //       function (ret_cb) {
    //         queryOrder(result.buyer, result.buy_id, (buy_order_cb) => {
    //           logger.info("buy_order_status ===> " + JSON.stringify(buy_order_cb));
    //           if (buy_order_cb.status != 2) {
    //             cancelOrder(result.buyer, result.buy_id, (cancel_buy_cb) => {
    //               logger.info("buy_order_cancel ===> " + JSON.stringify(cancel_buy_cb));
    //               result.cancel_buy = result.buy_id;
    //               ret_cb(null, cancel_buy_cb);
    //             })
    //           } else {
    //             ret_cb(null, buy_order_cb);
    //           }
    //         })
    //       },
    //       function (ret_cb) {
    //         queryOrder(result.seller, result.sell_id, (sell_order_cb) => {
    //           logger.info("sell_order_status ===> " + JSON.stringify(sell_order_cb));
    //           if (sell_order_cb.status != 2) {
    //             cancelOrder(result.seller, result.sell_id, (cancel_sell_cb) => {
    //               logger.info("sell_order_cancel ===> " + JSON.stringify(cancel_sell_cb));
    //               result.cancel_sell = result.sell_id;
    //               ret_cb(null, cancel_sell_cb);
    //             })
    //           } else {
    //             ret_cb(null, sell_order_cb);
    //           }
    //         })
    //       }
    //     ], function (ret_error, ret) {
    //       callback(null, ret);
    //     })
    //   }
    // }
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

function limitOrder(user, type, price, amount, order_cb) {
  let currTime = parseInt(Date.now() / 1000);
  let post_order = {
    amount: amount, //下单数量 
    apiKey: settings.digifinex[user].access_id,
    apiSecret: settings.digifinex[user].secret_key,
    price: price,
    symbol: market,
    timestamp: currTime,
    type: type
  }
  logger.info("market sell order ===> " + JSON.stringify(post_order))
  signature.digifinex(post_order, (cb) => {
    post_order.sign = cb.signature;
    let post_options = {
      url: 'https://openapi.digifinex.com/v2/trade',
      method: 'post',
      json: true,
      form: post_order
    }
    request(post_options, (err, response, order_body) => {
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
        if (err) {
          logger.info("myposition error ===> " + JSON.stringify(err));
          callback('查询余额失败', null);
        } else {
          logger.info("myposition ===> " + JSON.stringify(body));
          var balance = [];
          currency_arr.forEach(currency => {
            if (body.free != null) {
              balance.push({
                market: currency,
                free: body.free[currency] == null ? 0 : body.free[currency],
                frozen: body.frozen[currency] == null ? 0 : body.frozen[currency]
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
      var user_a_btc = parseFloat(user_a[1].free);
      var user_b_usdt = parseFloat(user_b[0].free);
      var user_b_btc = parseFloat(user_b[1].free);
      if (user_a_usdt > deal_usdt && user_b_btc >= deal_count) {
        cb({
          user: 0
        })
      } else if (user_b_usdt > deal_usdt && user_a_btc >= deal_count) {
        cb({
          user: 1
        })
      } else {
        if (user_a_btc > deal_count || user_b_btc > deal_count) {
          let sell_user = 0;
          if (user_a_btc < user_b_btc) {
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
        } else if (user_a_btc < deal_count && user_a_usdt < deal_usdt && user_b_btc < deal_count && user_b_usdt < deal_usdt) {
          var sell_user = 0;
          var buy_user = 1;
          if (user_a_btc > user_b_btc) {
            sell_user = 1;
            buy_user = 0;
          }
          // a 用户btc较多，a保留btc，b保留usdt
          async.parallel([
            // a 把usdt换成btc,买入btc
            function (change_cb) {
              changeBalance(buy_user, 'buy', deal_count - user_a_btc, (market_change_cb) => {
                if (market_change_cb != null && market_change_cb.user != null) {
                  change_cb(null, market_change_cb);
                } else {
                  change_cb('market_change_cb buy error', market_change_cb);
                }
              })
            },
            // b 把btc换成usdt,卖出btc
            function (change_cb) {
              changeBalance(sell_user, 'sell', user_b_btc, (market_change_cb) => {
                if (market_change_cb != null && market_change_cb.user != null) {
                  change_cb(null, market_change_cb);
                } else {
                  change_cb('market_change_cb sell error', market_change_cb);
                }
              })
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

function queryNowPrice(user, type, amount, now_price_cb) {
  var currTime = parseInt(Date.now() / 1000);
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
        now_price_cb({});
      } else {
        if (type == 'buy') {
          // 从asks里面找
          let length = body.asks.length;
          var buy_price = 0;
          for (let index = length - 1; index >= 0; index--) {
            if (body.asks[index][1] > amount) {
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
            if (body.bids[index][1] > amount) {
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
  let currTime = parseInt(Date.now() / 1000);
  let post_body = {
    apiKey: settings.digifinex[user].access_id,
    apiSecret: settings.digifinex[user].secret_key,
    timestamp: currTime,
  }
  signature.digifinex(post_body, (sign) => {
    post_body.sign = sign.signature;
    let options = {
      url: 'https://openapi.digifinex.com/v2/open_orders',
      method: 'post',
      json: true,
      form: post_body
    }
    request(options, (error, buy_response, body) => {
      if (error) {
        logger.info("open_orders error ===> " + JSON.stringify(error));
        cancel_cb({});
      } else {
        logger.info("open_orders ===> " + JSON.stringify(body));
        if (body.code != null && body.code == 0 && body.orders != null && body.orders.length > 0) {
          async.map(body.orders, function (order, callback) {
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
// 查找合适的市场价交易
function changeBalance(user, type, amount, market_change_cb) {
  async.waterfall([
    function (market_order_cb) {
      queryNowPrice(user, type, amount, (now_price) => {
        logger.info("buy now_price ===> " + JSON.stringify(now_price));
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
      market_change_cb({
        user: buy_user == settings.digifinex.length - 1 ? 0 : buy_user + 1
      });
    }
  })
}