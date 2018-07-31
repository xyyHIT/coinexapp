var request = require('request');
var signature = require('../utils/signature');
var settings = require('../settings');
var log4js = require('log4js');
log4js.configure(settings.log4js);
var logger = log4js.getLogger(__filename);
var async = require('async');
var policy = [{
  currency: 'BTC',
  market: ["USDT", "BCH"],
  depth: 5
}]
var currency_set = new Set();
currency_set.add("BTC").add("BCH").add("ETH").add("USDT");

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
      find(market.currency, market.market, market.depth, (find_cb) => {
        if (find_cb) {
          callback(null, find_cb);
        } else {
          callback('未找到合适订单');
        }
      })
    },
    // 判断余额是否足够
    function (find_order, callback) {
      queryBalance(market.currency, (balance_cb) => {
        console.log("查询当前余额 ===> " + JSON.stringify(balance_cb));
        if (find_order.myIn.amount > balance_cb.available) {
          // 余额不足。需要转换
          console.log(" 。。。余额不足。。。");
          chargeBalance(market.currency, find_order.myIn.market, find_order.myIn.amount, (charge_cb) => {
            console.log(" 充值结果 ===> " + JSON.stringify(charge_cb));
            if (charge_cb.code == 107) {
              // 充值失败
              callback(charge_cb, null);
            } else {
              // 充值成功
              console.log("充值成功 ===> " + JSON.stringify(charge_cb));
              callback(null, find_order);
            }
          })
        } else {
          // 余额足够。直接交易
          console.log(" 。。。余额足够。。。");
          callback(null, find_order);
        }
      })
    },
    // 下单
    function (find_order, callback) {
      limitOrder(find_order, (order_cb) => {
        callback(null, order_cb);
      })
    }
  ], function (error, results) {
    if (error) {
      deal_cb(error);
    } else {
      deal_cb(results);
    }
  })
}

function limitOrder(find_order, order_cb) {
  console.log("find_order ===> " + JSON.stringify(find_order));
  async.series([
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

function find(currency, market, depth, find_cb) {
  var lowPriceTakes = new Map();
  var highPriceBids = new Map();
  async.each(market, function (marketName, callback) {
    let name = currency + marketName;
    queryMarketDepth(name, depth, function (depth_cb) {
      if (depth_cb.success) {
        lowPriceTakes.set(name, depth_cb.result.data.asks);
        highPriceBids.set(name, depth_cb.result.data.bids);
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

// 查询指定货币余额 
function queryBalance(coin, balance_cb) {
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
    if (coin) {
      balance_cb(result[coin]);
    } else {
      balance_cb(result);
    }
  })
}
// 充值，先获取最新价格
function chargeBalance(currency, market, amount, charge_cb) {
  let coin = market.substring(currency.length);
  async.waterfall([
    // 获取当前价格
    function (callback) {
      getCurrCoinCurrency((cb) => {
        callback(null, cb);
      })
    },
    // 查找价格最高
    function (currency, callback) {
      queryBalance(null, (balance_cb) => {
        var max_usd = -1;
        var max_coin = null;
        for (let name of currency_set) {
          if (name != coin) {
            var price = currency.get(name);
            var available = balance_cb[name].available;
            if (price * available > max_usd) {
              max_coin = name;
            }
          }
        }
        callback(null, max_coin);
      })
    },
    function (max_coin, callback) {
      let order = {
        market: currency + max_coin,
        amount: amount,
      };
      placeMarketOrder(order, 'sell', (order_cb) => {
        console.log(order_cb);
        callback(null, order_cb)
      })
    }
  ], function (error, result) {
    charge_cb(result);
  })
}

function getCurrCoinCurrency(cb) {
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
      if (currency_set.has(obj.symbol)) {
        currCNY.set(obj.symbol, obj.price_usd);
      }
    }
    cb(currCNY);
  })

}