var request = require('request');
var signature = require('../utils/signature');
var settings = require('../settings');
var log4js = require('log4js');
var logger = log4js.getLogger(__filename);
logger.level = 'info'; // default level is OFF - which means no logs at all.
var async = require('async');
var signature = require('../utils/signature');


var buys = ["CETBCH","CETBTC","CETETH","CETUSDT"];

//1. 获取最新价格
var lowSellPrice = new Map();
var highBuyerPrice = new Map();
async.each(buys, function(category, callback) {
  let depth_options = {
    url: 'https://api.coinex.com/v1/market/depth?market='+category+'&limit=5&merge=0.00000001',
    method: 'get'
  }
  request(depth_options, (err, response, body) => {
    if (err) {

    } else {
      var ret = JSON.parse(body);
      ret.data.asks.forEach(element => {
        if (parseFloat(element[1]) >= 100) {
          lowSellPrice.set(category, element);
        }
      });
      highBuyerPrice.set(category, ret.data.bids);
      callback(null);
    }
  })
}, function(err) {
  findOrder(lowSellPrice, highBuyerPrice, function(cb) {
    logger.info("findOrder ===>" + JSON.stringify(cb));
    async.parallel({
      sell: function(callback) {
        placeIOCOrder(cb.myOut, 'sell', (cb) => {
          callback(null, cb);
        })
      },
      buy: function(callback) {
        placeIOCOrder(cb.myIn, 'buy', (cb) => {
          callback(null, cb);
        })
      }
    }, (err, results) => {
      logger.info("results ===>" + JSON.stringify(results));
    })
  })
})



function keysort(key,sortType) {
  return function(a,b){
    if (sortType == 'up') {
      return (a[key] < b[key]) ? 1 : -1
    } else if (sortType == 'down'){
      return (a[key] >= b[key]) ? 1 : -1
    } else {
      return -1;
    }
  }
}

function findOrder(lowSellPrice, highBuyerPrice, cb) {
  // 循环买入低价的价格
  for(let [k,v] of highBuyerPrice) {
    for(let index in v) {
      var obj = v[index];
      var myOutPrice = parseFloat(obj[0]);
      var myOutCount = parseFloat(obj[1]);
      if (myOutCount >= 100 && myOutCount <= 500) {
        for(let [key, value] of lowSellPrice) {
          var myInPrice = parseFloat(value[0]);
          var myInCount = parseFloat(value[1]);
          // 如果卖出的价格高于我买入的价格 并且 卖出的总数能够大于
          if (myOutCount >= myInCount) {
            // 发现一组匹配, 判断手续费是否足够
            var profit = myOutPrice*myOutCount - myInPrice*myOutCount;
            var outTakes = myOutPrice*myOutCount*0.001;
            var inTakes = myInPrice*myOutCount*0.001;
            if (profit > (outTakes + inTakes)) {
              // 发现一组匹配
              logger.info("myIn ===> " + myInPrice +" "+ myInCount+" "+inTakes);
              logger.info("myOut ===> " + myOutPrice +" "+ myOutCount+" "+outTakes);
              logger.info("my profit ===> " + profit);
              return cb({
                myIn: {
                  market: key,
                  amount: myOutCount,
                  price: myInPrice
                },
                myOut: {
                  market: k,
                  amount: myOutCount,
                  price: myOutPrice
                }
              })
            }
          }
        }
      }
    }
  }
}

function placeIOCOrder(order, type, callback) {
  let currTime = Date.now();
  let postBody = {
    access_id: settings.access_id,
    amount: String(order.amount),
    market: order.market,
    price: String(order.price),
    tonce: currTime,
    type: type
  }
  signature.signature(postBody, true, (cb) => {
    logger.info(type + " signature ===>" + JSON.stringify(cb));
    let option = {
      url: 'https://api.coinex.com/v1/order/ioc',
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
        logger.info(type + " cb ===>" + JSON.stringify(body));
        callback({result: body});
      }
    })
  })
}




