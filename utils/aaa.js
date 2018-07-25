var request = require('request');
var signature = require('../utils/signature');
var settings = require('../settings');
var log4js = require('log4js');
log4js.configure(settings.log4js);
var logger = log4js.getLogger(__filename);
var async = require('async');

var buys = ["CETBCH", "CETBTC", "CETETH", "CETUSDT"];

setInterval(intervalFunc, 500);

function intervalFunc() {
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
              async.series({
                buy: function (callback) {
                  placeLimitOrder(maxProfitOrder.myIn, 'buy', (cb) => {
                    if (cb.code == 107) {
                      callback(107, cb);
                    } else {
                      callback(null, cb);
                    }
                  })
                },
                sell: function (callback) {
                  placeLimitOrder(maxProfitOrder.myOut, 'sell', (cb) => {
                    if (cb.code == 107) {
                      callback(107, cb);
                    } else {
                      callback(null, cb);
                    }
                  })
                }
              }, (err, results) => {
                if (err) {
                  logger.info("errr ===> " + JSON.stringify(err));
                  if (err == '107') {
                    chargeBalance(currCNY, function (chargeCallback) {
                      logger.info("充值完成 ===>" + JSON.stringify(chargeCallback));
                    })
                  }
                } else {
                  logger.info("订单已完成 ===>" + JSON.stringify(results));
                }
              })
            }
          }
        })
      }
    })
  })
}



function chargeBalance(currCNY, callback) {
  logger.info("currCNY ===> " + JSON.stringify(strMapToObj(currCNY)));
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
    },
    function (myBalances, callback) {
      var maxBalance = -1;
      var needChangeCount = 0;
      var maxCoin = null;
      for (let coin in myBalances) {
        logger.info("let coin ===>" + coin);
        var balance = myBalances[coin];
        if (coin == 'BTC') {
          let sum = parseFloat(balance.available * currCNY.get(coin));
          if (sum > maxBalance) {
            maxBalance = sum;
            maxCoin = {
              coin: 'CETBTC',
              total: sum
            }
            logger.info("max coin ===> " + maxCoin);
          }
          if (sum < 500) {
            needChangeCount += parseFloat(500 / currCNY.get(coin));
          }
        } else if (coin == 'BCH') {
          let sum = parseFloat(balance.available * currCNY.get(coin));
          if (sum > maxBalance) {
            maxBalance = sum;
            maxCoin = {
              coin: 'CETBCH',
              total: sum
            }
            logger.info("max coin ===> " + maxCoin);
          }
          if (sum < 500) {
            needChangeCount += parseFloat(500 / currCNY.get(coin));
          }
        } else if (coin == 'ETH') {
          let sum = parseFloat(balance.available * currCNY.get(coin));
          if (sum > maxBalance) {
            maxBalance = sum;
            maxCoin = {
              coin: 'CETETH',
              total: sum
            }
            logger.info("max coin ===> " + maxCoin);
          }
          if (sum < 500) {
            needChangeCount += parseFloat(500 / currCNY.get(coin));
          }
        } else if (coin == 'USDT') {
          let sum = parseFloat(balance.available * currCNY.get(coin));
          if (sum > maxBalance) {
            maxBalance = sum;
            maxCoin = {
              coin: 'CETUSDT',
              total: sum
            }
            logger.info("max coin ===> " + maxCoin);
          }
          if (sum < 500) {
            needChangeCount += parseFloat(500 / currCNY.get(coin));
          }
        }
      }
      logger.info(" maxCoinBalance ===> " + JSON.stringify(maxCoin));
      logger.info(" maxBalance ===> " + JSON.stringify(maxBalance));
      let sell_obj = {
        amount: String(needChangeCount),
        market: maxCoin.coin
      }
      callback(null, sell_obj);
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
      if (myOutCount >= 100 && myOutCount <= 2000) {
        for (let [key, value] of lowSellPrice) {
          for (let i in value) {
            var in_obj = value[i];
            var myInPrice = parseFloat(in_obj[0]);
            var myInCount = parseFloat(in_obj[1]);
            // 如果卖出的价格高于我买入的价格 并且 卖出的总数能够大于
            if (myOutCount >= myInCount) {
              // 发现一组匹配, 判断手续费是否足够
              var outUSD = currCNY.get(k);
              var inUSD = currCNY.get(key);
              var profit = myOutPrice * myOutCount * outUSD - myInPrice * myOutCount * inUSD;
              var outTakes = myOutPrice * myOutCount * outUSD;
              var inTakes = myInPrice * myOutCount * inUSD;
              if (profit > (outTakes + inTakes) * 0.003) {
                // 发现一组匹配
                logger.info("myIn ===> " + myInPrice + " " + myOutCount + " " + inTakes);
                logger.info("myOut ===> " + myOutPrice + " " + myOutCount + " " + outTakes);
                logger.info("my profit ===> " + profit);
                orders.push({
                  profit: profit,
                  myIn: {
                    market: key,
                    amount: myOutCount,
                    price: myInPrice,
                    usd: inUSD
                  },
                  myOut: {
                    market: k,
                    amount: myOutCount,
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