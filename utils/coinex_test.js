var request = require('request');
var signature = require('../utils/signature');
var settings = require('../settings');
var log4js = require('log4js');
log4js.configure(settings.log4js);
var logger = log4js.getLogger(__filename);
var async = require('async');
var policy_arr = [{
  currency: "BTC",
  market: ["BTCUSDT", "BTCBCH"],
  depth: 5
}, {
  currency: "ETH",
  market: ["ETHUSDT", "ETHBCH", "ETHBTC"],
  depth: 5
}]
var currency_set = new Set();
currency_set.add("BTC").add("BCH").add("ETH").add("USDT");

var charge_set = ["BTCBCH", "BTCUSDT", "BCHUSDT", "ETHBTC", "ETHBCH", "ETHUSDT"];

setInterval(intervalFunc, 1000);

function intervalFunc() {
  deal((deal_cb) => {
    console.log(JSON.stringify(deal_cb));
    console.log(" ------ 本次处理结束 -----------");
  })
}


function deal(deal_cb) {
  async.mapSeries(policy_arr, function (policy, cb) {
    dealMarket(policy, (deal_market_cb) => {
      cb(null, deal_market_cb);
    })
  }, function (err, done) {
    deal_cb(null, done);
  })
}


function dealMarket(policy, deal_cb) {
  async.waterfall([
    // 获取行情
    function (callback) {
      queryAllMarket((market_depth_set) => {
        //console.log("获取行情 ===> " + JSON.stringify(strMapToObj(market_depth_set)));
        callback(null, market_depth_set);
      })
    },
    // 平衡余额
    function (market_depth_set, callback) {
      balanceBalance(market_depth_set, (balance_cb) => {
        callback(null, market_depth_set);
      })
    },
    function (market_depth_set, callback) {
      var lowPriceTakes = new Map();
      var highPriceBids = new Map();
      policy.market.forEach(market => {
        lowPriceTakes.set(market, market_depth_set.get(market).asks);
        highPriceBids.set(market, market_depth_set.get(market).bids);
      });
      // 获取合适订单
      findOrder(market_depth_set, policy.currency, lowPriceTakes, highPriceBids, (order_cb) => {
        callback(null, order_cb);
      })
    },
    // 下单
    function (find_order, callback) {
      if (find_order.myIn && find_order.myOut) {
        limitOrder(find_order, (order_cb) => {
          callback(null, order_cb);
        })
      } else {
        callback(null, '未找到合适订单');
      }
    }
  ], function (error, results) {
    if (error) {
      deal_cb(error);
    } else {
      deal_cb(results);
    }
  })
}

function queryAllMarket(market_depth_cb) {
  var market_depth = new Map();
  async.each(charge_set, function (market, callback) {
    queryMarketDepth(market, 5, (depth_cb) => {
      market_depth.set(market, depth_cb.result.data);
      callback(null);
    })
  }, function (error) {
    market_depth_cb(market_depth);
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

/**
 * 
 * @param {当前市场行情} market_depth_set 
 * @param {本策略中的交易币} currcny 
 * @param {低价收单集合} lowPriceTakes 
 * @param {高价出单集合} highPriceBids 
 * @param {查找到合适订单} order_cb 
 */
function findOrder(market_depth_set, currency, lowPriceTakes, highPriceBids, order_cb) {
  var order = {};
  var max_profit = 0;
  for (let [key, value] of lowPriceTakes) {
    value.forEach(low => {
      var myInPrice = low[0];
      var totalInCount = low[1];
      var myInCount = totalInCount / 2;
      for (let [k, v] of highPriceBids) {
        if (key != k) {
          v.forEach(high => {
            var myOutPrice = high[0];
            var myOutCount = high[1];
            var usd_value = 500 / market_depth_set.get(currency + 'USDT').last;
            if (myInCount < myOutCount && myInCount < usd_value) {
              // 开始计算利润
              // 我买入的花费
              var inCurrency = key.substring(currency.length);
              var in_usd_value = 1;
              if (inCurrency != 'USDT') {
                in_usd_value = market_depth_set.get(inCurrency + 'USDT').last;
              }
              var myInCost = myInPrice * myInCount * (1.0 - 0.005) * in_usd_value;
              // 我卖出的收益
              var outCurrency = k.substring(currency.length);
              var out_usd_value = 1;
              if (outCurrency != 'USDT') {
                out_usd_value = market_depth_set.get(outCurrency + 'USDT').last;
              }
              var myOutSum = myOutPrice * myInCount * (1.0 - 0.005) * out_usd_value;
              var profit = myOutSum - myInCost;
              if (profit > 0 && profit > max_profit) {
                // 发现一组匹配
                max_profit = profit;
                order = {
                  myIn: {
                    market: key,
                    amount: (myInCount * myInPrice).toFixed(8),
                    price: myInPrice,
                    usdt_price: in_usd_value
                  },
                  myOut: {
                    market: k,
                    amount: myInCount,
                    price: myOutPrice,
                    usdt_price: out_usd_value
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
      var balanceMap = new Map();
      for (let v of currency_set) {
        balanceMap.set(v, result[v]);
      }
      balance_cb(balanceMap);
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
        console.log("充值结束 ===> " + JSON.stringify(order_cb));
        callback(null, order_cb)
      })
    }
  ], function (error, result) {
    charge_cb(result);
  })
}

function queryMarketStatis(market, statis_cb) {
  let options = {
    url: 'https://api.coinex.com/v1/market/ticker?market=' + market,
    method: 'get',
    json: true
  }
  request(options, (err, response, body) => {
    if (err) {
      logger.error("queryMarketStatis error ===>" + err);
      statis_cb({});
    } else {
      statis_cb({
        price: body.data.ticker.last
      })
    }
  })
}

// function queryBasePrice(base_price_cb) {
//   var basePriceMap = new Map();
//   async.each(BASE_PRICE, function (market, callback) {
//     queryMarketStatis(market, (statis_cb) => {
//       basePriceMap.set(market, statis_cb.price);
//       callback(null);
//     })
//   }, function (error) {
//     if (error) {
//       logger.error("queryBasePrice error ===> " + error);
//     }
//     base_price_cb(basePriceMap);
//   })
// }

function balanceBalance(market_depth_set, balance_cb) {
  async.waterfall([
    function (callback) {
      queryBalance(null, (balance_cb) => {
        callback(null, balance_cb);
      })
    },
    function (balanceMap, callback) {
      var needCharge = [];
      var max_balance = -1;
      var max = null;
      for (let [k, v] of balanceMap) {
        var price = 1;
        if (k != 'USDT') {
          price = market_depth_set.get(k + 'USDT').last;
        }
        var tmp = v.available * price;
        if (tmp > max_balance) {
          max = {
            name: k,
            value: v
          }
          max_balance = tmp;
        }
        if (tmp < 500) {
          needCharge.push(k);
        }
      }
      console.log("balance info needCharge ===> " + JSON.stringify(needCharge));
      console.log("balance info max ===> " + JSON.stringify(max));
      callback(null, needCharge, max);
    },
    function (needCharge, max_balance, callback) {
      if (needCharge.length > 0) {
        async.map(needCharge, function (charge_name, cb) {
          let charge_order = {};
          if (charge_set.indexOf(charge_name + max_balance.name) >= 0) {
            charge_order.market = charge_name + max_balance.name;
            charge_order.type = 'buy';
            charge_order.amount = 500;
          } else if (charge_set.indexOf(max_balance.name + charge_name) >= 0) {
            charge_order.market = max_balance.name + charge_name;
            charge_order.type = 'sell';
            var usd_charge_price = 1;
            if (charge_name != 'USDT') {
              usd_charge_price = market_depth_set.get(max_balance.name + 'USDT').last;
            }
            charge_order.amount = (500 / usd_charge_price).toFixed(8);
          }
          console.log("charge_order ===> " + JSON.stringify(charge_order));
          placeMarketOrder(charge_order, charge_order.type, (order_cb) => {
            cb(null, order_cb);
          })
        }, function (error, result) {
          callback(null, result);
        })
      } else {
        callback(null, 'not need charge');
      }
    }
  ], function (error, results) {
    console.log(JSON.stringify(results));
    balance_cb(results);
  })
}

function strMapToObj(strMap) {
  let obj = Object.create(null);
  for (let [k, v] of strMap) {
    obj[k] = v;
  }
  return obj;
}