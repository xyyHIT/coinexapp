var request = require('request');
var signature = require('../utils/signature');
var settings = require('../settings');
var log4js = require('log4js');
log4js.configure(settings.log4js);
var logger = log4js.getLogger(__filename);
var async = require('async');

var buys = ["BACBCH", "BACBTC", "BACETH"];
setInterval(intervalFunc, 2000);

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
        currCNY.set('BACBTC', obj.price_usd);
      } else if (obj.symbol == 'ETH') {
        currCNY.set('BACETH', obj.price_usd);
      } else if (obj.symbol == 'BCH') {
        currCNY.set('BACBCH', obj.price_usd);
      }
    }
    //2. 开始寻找符合的价格
    var lowSellPrice = new Map();
    var highBuyerPrice = new Map();
    async.each(buys, function (category, callback) {
      let depth_options = {
        url: 'https://www.bitasiabit.com/app/v1/getFullDepthCus?pairname=' + category,
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
                  placeLimitOrder(maxProfitOrder.myIn, '0', (cb) => {
                    callback(null, cb);
                  })
                },
                sell: function (callback) {
                  placeLimitOrder(maxProfitOrder.myOut, '1', (cb) => {
                    callback(null, cb);
                  })
                }
              }, (err, results) => {
                if (err) {
                  logger.info("充值完成 ===>" + JSON.stringify(chargeCallback));
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


function strMapToObj(strMap) {
  let obj = Object.create(null);
  for (let [k, v] of strMap) {
    obj[k] = v;
  }
  return obj;
}

function findOrder(lowSellPrice, highBuyerPrice, currCNY, cb) {
  logger.info("currCNY ===> " + JSON.stringify(strMapToObj(currCNY)));
  logger.info(lowSellPrice);
  logger.info(highBuyerPrice);
  // 循环买入低价的价格
  var orders = [];
  for (let [k, v] of highBuyerPrice) {
    for (let index in v) {
      var obj = v[index];
      var myOutPrice = parseFloat(obj[0]);
      var myOutCount = parseFloat(obj[1]);
      if (myOutCount >= 10 && myOutCount <= 2000) {
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
              var outTakes = myOutPrice * myOutCount * 0.001 * outUSD;
              var inTakes = myInPrice * myOutCount * 0.001 * inUSD;
              if (profit > (outTakes + inTakes)) {
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
// 0-买  1-卖
function placeLimitOrder(order, type, callback) {
  let post_data = {
    secretKey: settings.asiaex.secret_key,
    type: type,
    pairname: order.market,
    price: String(order.price),
    count: String(order.amount)
  }
  signature.asiaex(post_data, (cb) => {
    //logger.info(type + " signature ===>" + JSON.stringify(cb));
    let post_body = {
      apiKey: settings.asiaex.api_key,
      data: cb.signature
    }
    let option = {
      url: 'https://www.bitasiabit.com/app/v1/entrustSubmitCus',
      method: 'post',
      json: true,
      body: post_body
    }
    request(option, (err, response, body) => {
      if (err) {

      } else {
        logger.info(type + " cb ===>" + JSON.stringify(body));
        callback({
          result: body
        });
      }
    })
  })
}