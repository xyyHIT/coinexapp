var request = require('request');
var signature = require('../utils/signature');
var settings = require('../settings');
var log4js = require('log4js');
log4js.configure(settings.log4js);
var logger = log4js.getLogger(__filename);
var async = require('async');

var buys = ["CETBCH", "CETBTC", "CETETH", "CETUSDT"];
var doing = false;

setInterval(intervalFunc, 500);

function intervalFunc() {
  if (!doing) {
    doing = true;
    //1. 获取最新价格
    let option = {
      url: 'https://api.coinmarketcap.com/v1/ticker/',
      method: 'get',
      json: true
    }
    var currCNY = new Map();
    request(option, (err, response, body) => {
      for (let index in body) {
        var obj = body[index];
        if (obj.symbol == 'BTC') {
          currCNY.set('CETBTC', obj.price_usd);
        } else if (obj.symbol == 'ETH') {
          currCNY.set('CETETH', obj.price_usd);
        } else if (obj.symbol == 'BCH') {
          currCNY.set('CETBCH', obj.price_usd);
        } else if (obj.symbol == 'USDT') {
          currCNY.set('CETUSDT', obj.price_usd);
        }
      }
      //2. 开始寻找符合的价格
      var lowSellPrice = new Map();
      var highBuyerPrice = new Map();
      async.each(buys, function (category, callback) {
        let depth_options = {
          url: 'https://api.coinex.com/v1/market/depth?market=' + category + '&limit=10&merge=0.00000001',
          method: 'get'
        }
        request(depth_options, (err, response, body) => {
          logger.debug(category + " info body ===> " + body);
          if (err) {

          } else {
            var ret = JSON.parse(body);
            // var currLowPrice = 1.0;
            // ret.data.asks.forEach(element => {
            //   if (parseFloat(element[1]) >= 100) {
            //     if (currLowPrice > element[0]) {
            //       lowSellPrice.set(category, element);
            //     }
            //   }
            // });
            lowSellPrice.set(category, ret.data.asks);
            highBuyerPrice.set(category, ret.data.bids);
            callback(null);
          }
        })
      }, function (err) {
        if (err) {
          logger.error(" err ===> " + JSON.stringify(err));
        } else {
          findOrder(lowSellPrice, highBuyerPrice, currCNY, function (cb) {
            logger.debug("findOrder ===>" + JSON.stringify(cb));
            if (cb.length == 0) {
              logger.info("-------------- 未找到合适订单，本次处理结束 --------------");
              doing = false;
            } else {
              var maxProfit = 0;
              var maxProfitOrder = null;
              for (let index in cb) {
                var order = cb[index];
                if (order.profit > maxProfit) {
                  maxProfitOrder = order;
                }
              }
              logger.info("find MAX profit Order ===>" + JSON.stringify(maxProfitOrder));
              if (maxProfitOrder && maxProfitOrder.myOut && maxProfitOrder.myIn) {
                // 判断是否有足够
                checkBalance(currCNY, maxProfitOrder, (charge_cb) => {
                  logger.info("charge_cb ===> " + JSON.stringify(charge_cb));
                  if (charge_cb.finish) {
                    async.series({
                      sell: function (back) {
                        placeLimitOrder(maxProfitOrder.myOut, 'sell', (sell_cb) => {
                          if (sell_cb.code == 107) {
                            back(107, sell_cb);
                          } else {
                            back(null, sell_cb);
                          }
                        })
                      },
                      buy: function (back) {
                        placeLimitOrder(maxProfitOrder.myIn, 'buy', (buy_cb) => {
                          if (buy_cb.code == 107) {
                            back(107, buy_cb);
                          } else {
                            back(null, buy_cb);
                          }
                        })
                      }
                    }, (err, results) => {
                      if (err) {
                        logger.info("订单失败 ===>" + JSON.stringify(err));
                      } else {
                        logger.info("订单完成 ===>" + JSON.stringify(results));
                      }
                      doing = false;
                    })
                  }
                })
              }
            }
          })
        }
      })
    })
  }

}

function getMyBalances(balance_callback) {
  async.waterfall([
    function (callback) {
      let currTime = Date.now();
      var str = "access_id=" + settings.coinex.access_id + "&tonce=" + currTime;
      signature.signature(str, false, function (cb) {
        callback(null, currTime, cb);
      })
    },
    function (currTime, signatureStr, callback) {
      let options = {
        url: 'https://api.coinex.com/v1/balance/info',
        headers: {
          authorization: signatureStr.signature
        },
        qs: {
          access_id: settings.coinex.access_id,
          tonce: currTime
        },
        json: true,
      }
      request.get(options, (err, response, body) => {
        if (err) {

        } else {
          callback(null, body.data);
        }
      })
    }
  ], function (err, result) {
    balance_callback(result);
  })
}
// 判断是否完成订单的余额足够。如果余额不够充值
function checkBalance(currCNY, order, chargeCallback) {
  logger.info("chargeBalance currCNY ===> " + JSON.stringify(strMapToObj(currCNY)));
  var buy_order = order.myIn;
  async.waterfall([
    function (callback) {
      getMyBalances((balance_cb) => {
        callback(null, balance_cb);
      })
    },
    function (myBalances, callback) {
      var maxBalance = -1.0;
      var needChangeCount = 0;
      var maxCoin = null;
      var needCharge = true;
      for (let coin in myBalances) {
        var balance = myBalances[coin];
        if (coin == 'BTC') {
          coin = 'CET' + coin;
          let sum = parseFloat(balance.available) * parseFloat(currCNY.get(coin));
          if (sum > maxBalance) {
            maxBalance = sum;
            maxCoin = {
              coin: coin,
              total: sum
            }
          }
        } else if (coin == 'BCH') {
          coin = 'CET' + coin;
          let sum = parseFloat(balance.available) * parseFloat(currCNY.get(coin));
          if (sum > maxBalance) {
            maxBalance = sum;
            maxCoin = {
              coin: coin,
              total: sum
            }
          }
        } else if (coin == 'ETH') {
          coin = 'CET' + coin;
          let sum = parseFloat(balance.available) * parseFloat(currCNY.get(coin));
          if (sum > maxBalance) {
            maxBalance = sum;
            maxCoin = {
              coin: coin,
              total: sum
            }
          }
        } else if (coin == 'USDT') {
          coin = 'CET' + coin;
          let sum = parseFloat(balance.available) * parseFloat(currCNY.get(coin));
          if (sum > maxBalance) {
            maxBalance = sum;
            maxCoin = {
              coin: coin,
              total: sum
            }
          }
        } else if (coin == 'CET') {
          if (balance.available > buy_order.amount) {
            // 余额足够，不需要充值
            needCharge = false;
            break;
          } else {
            needCharge = true;
          }
        }
      }
      if (needCharge) {
        needChangeCount = buy_order.amount * buy_order.price * parseFloat(currCNY.get(buy_order.market)) / parseFloat(currCNY.get(maxCoin.coin));
        logger.info("needChangeCount ===>" + needChangeCount);
      }
      let charge_obj = {
        amount: String(needChangeCount.toFixed(8)),
        market: maxCoin.coin,
        needCharge: needCharge
      }
      callback(null, charge_obj);
    },
    function (charge_obj, callback) {
      logger.info("charge_obj ===> " + JSON.stringify(charge_obj));
      if (charge_obj.needCharge) {
        placeMarketOrder(charge_obj, 'buy', (order_cb) => {
          logger.info(" 充值完成 ===>" + JSON.stringify(order_cb));
          callback(null, {
            finish: true
          })
        })
      } else {
        callback(null, {
          finish: true
        });
      }
    }
  ], function (err, result) {
    chargeCallback(result);
  })
}


function keysort(key, sortType) {
  return function (a, b) {
    if (sortType == 'up') {
      return (a[key] < b[key]) ? 1 : -1
    } else if (sortType == 'down') {
      return (a[key] >= b[key]) ? 1 : -1
    } else {
      return -1;
    }
  }
}

function strMapToObj(strMap) {
  let obj = Object.create(null);
  for (let [k, v] of strMap) {
    obj[k] = v;
  }
  return obj;
}

function findOrder(lowSellPrice, highBuyerPrice, currCNY, cb) {
  logger.debug("currCNY ===> " + JSON.stringify(strMapToObj(currCNY)));
  logger.debug(JSON.stringify(strMapToObj(lowSellPrice)));
  logger.debug(JSON.stringify(strMapToObj(highBuyerPrice)));
  // 循环买入低价的价格
  var orders = [];
  for (let [k, v] of highBuyerPrice) {
    for (let index in v) {
      var obj = v[index];
      var myOutPrice = parseFloat(obj[0]);
      var myOutCount = parseFloat(obj[1]);
      if (myOutCount >= 100) {
        for (let [key, value] of lowSellPrice) {
          if (k != key) {
            for (let i in value) {
              var in_obj = value[i];
              var myInPrice = parseFloat(in_obj[0]);
              var myInCount = parseFloat(in_obj[1]);
              // 如果卖出的价格高于我买入的价格 并且 卖出的总数能够大于
              if (myOutCount >= myInCount && myInCount >= 100) {
                // 发现一组匹配, 判断手续费是否足够
                var outUSD = currCNY.get(k);
                var inUSD = currCNY.get(key);
                var outOrder = myOutPrice * myInCount * outUSD;
                var inOrder = myInPrice * myInCount * inUSD;
                var profit = outOrder - inOrder;
                var takes = (outOrder + inOrder) * 0.002;
                if (profit > takes) {
                  // 发现一组匹配
                  // logger.info("myIn ===> " + myInPrice + " " + myOutCount);
                  // logger.info("myOut ===> " + myOutPrice + " " + myOutCount);
                  logger.info("my profit ===> " + profit + " takes ===>" + takes);
                  orders.push({
                    profit: profit,
                    myIn: {
                      market: key,
                      amount: myInCount,
                      price: myInPrice,
                      usd: inUSD
                    },
                    myOut: {
                      market: k,
                      amount: myInCount,
                      price: myOutPrice,
                      usd: outUSD
                    }
                  })
                }
              }
            }
          }
        }
      }
    }
  }
  cb(orders);
}

function placeMarketOrder(order, type, callback) {
  let currTime = Date.now();
  let postBody = {
    access_id: settings.coinex.access_id,
    amount: String(order.amount),
    market: order.market,
    tonce: currTime,
    type: type
  }
  signature.signature(postBody, true, (cb) => {
    //logger.info(type + " signature ===>" + JSON.stringify(cb));
    let option = {
      url: 'https://api.coinex.com/v1/order/market',
      method: 'post',
      headers: {
        authorization: cb.signature
      },
      json: true,
      body: postBody
    }
    request(option, (err, response, body) => {
      if (err) {

      } else {
        logger.info("market " + type + " cb ===>" + JSON.stringify(body));
        callback(body);
      }
    })
  })
}

function placeLimitOrder(order, type, callback) {
  let currTime = Date.now();
  let postBody = {
    access_id: settings.coinex.access_id,
    amount: String(order.amount),
    market: order.market,
    price: String(order.price),
    tonce: currTime,
    type: type
  }
  signature.signature(postBody, true, (cb) => {
    //logger.info(type + " signature ===>" + JSON.stringify(cb));
    let option = {
      url: 'https://api.coinex.com/v1/order/limit',
      method: 'post',
      headers: {
        authorization: cb.signature
      },
      json: true,
      body: postBody
    }
    request(option, (err, response, body) => {
      if (err) {

      } else {
        logger.info("limit " + type + " cb ===>" + JSON.stringify(body));
        callback(body);
      }
    })
  })
}