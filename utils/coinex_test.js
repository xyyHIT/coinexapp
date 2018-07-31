var request = require('request');
var signature = require('../utils/signature');
var settings = require('../settings');
var log4js = require('log4js');
log4js.configure(settings.log4js);
var logger = log4js.getLogger(__filename);
var async = require('async');
var policy = [{
    market: ["BTCUSDT", "BTCBCH"],
    depth: 5
  },
  {
    market: ["ETHUSDT", "ETHBCH", "ETHBTC"],
    depth: 5
  }
]

async.map(policy, function (market, callback) {
  dealMarket(market, (deal_cb) => {
    callback(deal_cb);
  })
}, function (error, results) {
  console.log(JSON.stringify(results));
})


function dealMarket(market, deal_cb) {
  async.waterfall([
    function (callback) {
      // 获取合适订单
      find(market.market, market.depth, (find_cb) => {
        if (find_cb) {
          callback(null, find_cb);
        } else {
          callback('未找到合适订单');
        }
      })
    },
    function (find_order, callback) {
      limitOrder(find_order, (order_cb) => {
        callback(order_cb);
      })
    }
  ], function (error, results) {
    deal_cb(results);
  })
}

function limitOrder(find_order, order_cb) {
  async.parallel([
    function (callback) {
      placeLimitOrder(find_order.myIn, 'buy', (buy_cb) => {
        if (buy_cb.code == 107) {
          callback(107, buy_cb);
        } else {
          //lastHourCount += maxProfitOrder.myIn.amount;
          callback(null, buy_cb);
        }
      })
    },
    function (callback) {
      placeLimitOrder(find_order.myOut, 'sell', (sell_cb) => {
        if (sell_cb.code == 107) {
          callback(107, sell_cb);
        } else {
          //lastHourCount += maxProfitOrder.myOut.amount;
          callback(null, sell_cb);
        }
      })
    }
  ], function (error, results) {
    order_cb(results);
  })
}

function find(market, depth, find_cb) {
  var lowPriceTakes = new Map();
  var highPriceBids = new Map();
  async.each(market, function (marketName, callback) {
    queryMarketDepth(marketName, depth, function (depth_cb) {
      if (depth_cb.success) {
        lowPriceTakes.set(marketName, depth_cb.result.data.asks);
        highPriceBids.set(marketName, depth_cb.result.data.bids);
        callback(null);
      } else {
        callback(depth_cb.result);
      }
    })
  }, function (error, results) {
    if (error) {
      find_cb(null);
    } else {
      findOrder(lowPriceTakes, highPriceBids, (order_cb) => {
        find_cb(order_cb);
      })
    }
  })
}

function findOrder(lowPriceTakes, highPriceBids, order_cb) {
  var order = {};
  var max_profit = 0;
  for (let [key, value] of lowPriceTakes) {
    value.forEach(low => {
      var myInPrice = low[0];
      var myInCount = low[1];
      for (let [k, v] of highPriceBids) {
        if (key != k) {
          v.forEach(high => {
            var myOutPrice = high[0];
            var myOutCount = high[1];
            if (myInCount < myOutCount) {
              // 开始计算利润
              // 我买入的花费
              var myInCost = myInPrice * myInCount * (1.0 - 0.0015);
              // 我卖出的收益
              var myOutSum = myOutPrice * myInCount * (1.0 - 0.0015);
              var profit = myOutSum - myInCost;
              if (profit > 0 && profit > max_profit) {
                // 发现一组匹配
                max_profit = profit;
                order = {
                  myIn: {
                    market: key,
                    amount: myInCount,
                    price: myInPrice
                  },
                  myOut: {
                    market: k,
                    amount: myInCount,
                    price: myOutPrice
                  }
                }
              }
            }
          })
        }
      }
    })
  }
  order_cb(order);
}


function queryMarketDepth(category, depth, depth_cb) {
  let depth_options = {
    url: 'https://api.coinex.com/v1/market/depth?market=' + category + '&limit=' + depth + '&merge=0.00000001',
    method: 'get',
    json: true
  }
  request(depth_options, (err, response, body) => {
    if (err) {
      depth_cb({
        success: false,
        result: err
      })
    } else {
      depth_cb({
        success: true,
        result: body
      })
    }
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

// function getMyBalances(balance_cb) {
//   async.waterfall([
//     function (callback) {
//       let currTime = Date.now();
//       var str = "access_id=" + settings.coinex.access_id + "&tonce=" + currTime;
//       signature.signature(str, false, function (cb) {
//         callback(null, currTime, cb);
//       })
//     },
//     function (currTime, signatureStr, callback) {
//       let options = {
//         url: 'https://api.coinex.com/v1/balance/info',
//         headers: {
//           authorization: signatureStr.signature
//         },
//         qs: {
//           access_id: settings.coinex.access_id,
//           tonce: currTime
//         },
//         json: true,
//       }
//       request.get(options, (err, response, body) => {
//         if (err) {

//         } else {
//           callback(null, body.data);
//         }
//       })
//     }
//   ], function (err, result) {
//     var balanceMap = {};
//     async.eachOf(result, function (value, key, callback) {
//       if (buys['CET' + key] || key == 'CET') {
//         balanceMap['CET' + key] = value;
//       }
//       callback();
//     }, function (err) {
//       console.log(balanceMap);
//     })
//     balance_callback(balanceMap);
//   })
// }
// // 判断余额是否足够，不够就从最多的里面转20000个CET
// function checkBalance(balance, order, checkBalance_cb) {
//   if (order.myIn.amount < balance['CETCET']) {
//     checkBalance_cb({
//       success: true
//     });
//   } else {
//     // 需要充值，选获取最新价格

//   }
// }