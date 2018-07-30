var request = require('request');
var signature = require('../utils/signature');
var settings = require('../settings');
var log4js = require('log4js');
log4js.configure(settings.log4js);
var logger = log4js.getLogger(__filename);
var async = require('async');

var buys = ["CETBCH", "CETBTC", "CETETH", "CETUSDT"];
var lastTimestamp = 0;
var lastHourCount = 0;
var maxHortCount = 57600;

setInterval(intervalFunc, 500);

function intervalFunc() {
  var callTime = Date.now() / 1000;
  if (callTime - lastTimestamp >= 3600) {
    var date_call_time = new Date(callTime * 1000);
    var year = date_call_time.getFullYear();
    var month = date_call_time.getMonth() + 1;
    var date = date_call_time.getDate();
    var hour = date_call_time.getHours();
    var stringTime = [year, month, date].join('-') + " " + hour + ":00:00";
    lastTimestamp = Date.parse(new Date(stringTime)) / 1000;
    lastHourCount = 0;
  }
  logger.info(new Date(lastTimestamp * 1000).toLocaleString() + " 已完成交易总额: " + lastHourCount + "/" + maxHortCount);
  if (lastHourCount < maxHortCount) {
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
          method: 'get',
          json: true
        }
        request(depth_options, (err, response, body) => {
          logger.debug(category + " info body ===> " + body);
          if (err) {

          } else {
            lowSellPrice.set(category, body.data.asks);
            highBuyerPrice.set(category, body.data.bids);
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
                      // 先卖掉我的CET换回需要的币
                      sell: function (back) {
                        placeLimitOrder(maxProfitOrder.myIn, 'sell', (sell_cb) => {
                          if (sell_cb.code == 107) {
                            back(107, sell_cb);
                          } else {
                            lastHourCount += maxProfitOrder.myIn.amount;
                            back(null, sell_cb);
                          }
                        })
                      },
                      // 再用另外的币种买回CET
                      buy: function (back) {
                        placeLimitOrder(maxProfitOrder.myOut, 'buy', (buy_cb) => {
                          if (buy_cb.code == 107) {
                            back(107, buy_cb);
                          } else {
                            lastHourCount += maxProfitOrder.myOut.amount;
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

function getMyBalances(currCNY, balance_callback) {
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
    var balanceMap = {};
    var max_balance_usd = -1;
    async.eachOf(result, function (value, key, callback) {
      if (key == 'BCH' || key == 'BTC' || key == 'ETH' || key == 'USDT') {
        var tmp = currCNY.get('CET' + key) * value.available;
        if (tmp > max_balance_usd) {
          balanceMap['MAX'] = key;
        }
      } else if (key == 'CET') {
        balanceMap['CET'] = value.available;
      }
      callback();
    }, function (err) {
      console.log(balanceMap);
    })
    balance_callback(balanceMap);
  })
}
// 判断是否完成订单的余额足够。如果余额不够充值
function checkBalance(currCNY, order, chargeCallback) {
  async.waterfall([
    // 查询余额
    function (callback) {
      getMyBalances(currCNY, (balance_cb) => {
        callback(null, balance_cb);
      })
    },
    // 判断是否需要充值
    function (myBalances, callback) {
      if (order.myIn.amount < myBalances["CET"]) {
        //余额足够，直接跳出
        callback('no need charge', myBalances);
      } else {
        //余额不足。需要充值
        var max_category = 'CET' + myBalances["MAX"];
        let charge_obj = {
          amount: String(parseFloat(500 / currCNY.get(max_category)).toFixed(8)),
          market: max_category
        }
        callback(null, charge_obj);
      }
    },
    function (charge_obj, callback) {
      logger.info("charge_obj ===> " + JSON.stringify(charge_obj));
      placeMarketOrder(charge_obj, 'buy', (order_cb) => {
        logger.info(" 充值完成 ===>" + JSON.stringify(order_cb));
        callback(null, {
          finish: true
        })
      })
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
  for (let [k, v] of lowSellPrice) {
    for (let index in v) {
      var obj = v[index];
      var myInPrice = parseFloat(obj[0]);
      var myInCount = parseFloat(obj[1]);
      if (myInCount >= 100 && myInCount <= 5000) {
        for (let [key, value] of highBuyerPrice) {
          if (k != key) {
            for (let i in value) {
              var in_obj = value[i];
              var myOutPrice = parseFloat(in_obj[0]);
              var myOutCount = parseFloat(in_obj[1]);
              // 如果卖出的价格高于我买入的价格 并且 卖出的总数能够大于
              if (myInCount < myOutCount) {
                // 发现一组匹配, 判断手续费是否足够
                var outUSD = currCNY.get(key);
                var inUSD = currCNY.get(k);
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
                      market: k,
                      amount: myInCount,
                      price: myInPrice,
                      usd: inUSD
                    },
                    myOut: {
                      market: key,
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