var request = require('request');
var signature = require('../utils/signature');
var settings = require('../settings');
var log4js = require('log4js');
log4js.configure(settings.log4js);
var logger = log4js.getLogger(__filename);
var async = require('async');
var signature = require('../utils/signature');


var buys = ["CETBCH","CETBTC","CETETH","CETUSDT"];
var apis = ["bitcoin-cash","bitcoin","ethereum","tether"];

//1. 获取最新价格
var lowSellPrice = new Map();
var highBuyerPrice = new Map();
async.each(buys, function(category, callback) {
  let depth_options = {
    url: 'https://api.coinex.com/v1/market/depth?market='+category+'&limit=5&merge=0.00000001',
    method: 'get'
  }
  request(depth_options, (err, response, body) => {
    logger.info(category + " info body ===> " + body);
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
}, function(err) {
  findOrder(lowSellPrice, highBuyerPrice, function(cb) {
    logger.info("findOrder ===>" + JSON.stringify(cb));
    if (cb.myOut && cb.myIn) {
      async.parallel({
        sell: function(callback) {
          placeLimitOrder(cb.myOut, 'sell', (cb) => {
            callback(null, cb);
          })
        },
        buy: function(callback) {
          placeLimitOrder(cb.myIn, 'buy', (cb) => {
            callback(null, cb);
          })
        }
      }, (err, results) => {
        logger.info("results ===>" + results);
        logger.info("-------------- 订单已完成，本次处理结束 ---------------");
      })
    } else {
      logger.info("-------------- 未找到合适订单，本次处理结束 --------------");
    }

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

function strMapToObj(strMap){
  let obj= Object.create(null);
  for (let[k,v] of strMap) {
    obj[k] = v;
  }
  return obj;
}

function findOrder(lowSellPrice, highBuyerPrice, cb) {
  async.waterfall([
    function(callback) {
      let option = {
        url: 'https://api.coinmarketcap.com/v1/ticker/',
        method: 'get',
        json: true
      }
      var currCNY = new Map();
      request(option, (err, response, body) => {
        for(let index in body) {
          var obj = body[index];
          if (obj.symbol == 'BTC') {
            currCNY.set('BTC', obj.price_usd);
          } else if (obj.symbol == 'ETH') {
            currCNY.set('ETH', obj.price_usd);
          } else if (obj.symbol == 'BCH') {
            currCNY.set('BCH', obj.price_usd);
          } else if (obj.symbol == 'USDT') {
            currCNY.set('USDT', obj.price_usd);
          }
        }
        callback(null, currCNY);
      })
    },
    function(currCNY, callback) {
      logger.info("currCNY ===> " + JSON.stringify(strMapToObj(currCNY)));
      logger.info(JSON.stringify(strMapToObj(lowSellPrice)));
      logger.info(JSON.stringify(strMapToObj(highBuyerPrice)));
      // 循环买入低价的价格
      var total = 0;
      for(let [k,v] of highBuyerPrice) {
        for(let index in v) {
          var obj = v[index];
          var myOutPrice = parseFloat(obj[0]);
          var myOutCount = parseFloat(obj[1]);
          if (myOutCount >= 100 && myOutCount <= 500) {
            for(let [key, value] of lowSellPrice) {
              for(let i in value) {
                var in_obj = value[i];
                var myInPrice = parseFloat(in_obj[0]);
                var myInCount = parseFloat(in_obj[1]);
                // 如果卖出的价格高于我买入的价格 并且 卖出的总数能够大于
                if (myOutCount >= myInCount && myInCount>=100  && myInCount<=500) {
                  // 发现一组匹配, 判断手续费是否足够
                  logger.info(" >>>>>>>> ");
                  var profit = myOutPrice*myOutCount*currCNY[key] - myInPrice*myOutCount*currCNY[k];
                  console.log("profit ===> "+profit.valueOf());
                  var outTakes = myOutPrice*myOutCount*0.001*currCNY[key];
                  var inTakes = myInPrice*myOutCount*0.001*currCNY[k];
                  if (profit > (outTakes + inTakes)) {
                    // 发现一组匹配
                    logger.info("myIn ===> " + myInPrice +" "+ myOutCount+" "+inTakes);
                    logger.info("myOut ===> " + myOutPrice +" "+ myOutCount+" "+outTakes);
                    logger.info("my profit ===> " + profit);
                    callback(null, {
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
      callback(null, {});
    }
  ], function(err, result) {
    logger.info("result ===> " + result);
    cb(result);
  })
}

function placeLimitOrder(order, type, callback) {
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
        logger.info(type + " cb ===>" + JSON.stringify(body));
        callback({result: body});
      }
    })
  })
}




