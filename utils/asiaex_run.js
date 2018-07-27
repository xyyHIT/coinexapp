var request = require('request');
var signature = require('../utils/signature');
var settings = require('../settings');
var log4js = require('log4js');
log4js.configure(settings.log4js);
var logger = log4js.getLogger(__filename);
var async = require('async');

let PAIRENAME = 'BACCNY';
let BUY = '0';
let SELL = '1';
let MIN_COUNT = 1; //4200;
let MAX_COUNT = 10; //20000;
let ORDER_WAIT = 1;
let ORDER_PART = 2;
let ORDER_FINISH = 3;
let ORDER_CANCEL = 5;
var lastUserIndex = 0;
var lastAction = null;
var lastEntrustId = null;

setInterval(intervalFunc, 500);

function intervalFunc() {
  // 查询是否有委托卖单
  if (lastAction && lastEntrustId) {
    let query_order = {
      secretKey: settings.asiaex[lastUserIndex].secret_key,
      entrustId: lastEntrustId,
      pairname: PAIRENAME
    }
    signature.asiaex(query_order, settings.asiaex[lastUserIndex].public_key, (cb_signature) => {
      let query_data = {
        apiKey: settings.asiaex[lastUserIndex].api_key,
        data: cb_signature.signature
      }
      let query_body = {
        url: 'https://www.bitasiabit.com/app/v1/userEntrustSearchCus',
        method: 'post',
        json: true,
        body: query_data
      }
      request(query_body, (err, response, body) => {
        console.log("query body ===> " + JSON.stringify(body));
        if (err) {
          console.log("查询委托信息失败 ===> " + err);
        } else {
          var order = body.data[0];
          if (order.type == 'SELL') {
            if (order.statusType == ORDER_FINISH) {
              //卖出完成
              lastEntrustId = null;
              lastAction = null;
              console.log("委托卖出完成 ===> " + JSON.stringify(body.data));
            } else if (order.statusType == ORDER_WAIT || order.statusType == ORDER_PART) {
              // 部分成交或者没有成交(准备买入信息)
              var buy_order = {
                price: order.price,
                count: order.leftCount,
                userIndex: lastUserIndex == settings.asiaex.length - 1 ? 0 : sellerIndex + 1
              }
              console.log("委托卖出 未 完成 ===> " + JSON.stringify(body.data));
              // 开始买入
              placeLimitOrder(buy_order, BUY, function (buy_cb) {
                console.log("buy_cb ===> " + JSON.stringify(buy_cb));
                if (buy_cb.success && buy_cb.result.code == 200) {
                  // 委托成功
                  lastAction = BUY;
                  lastEntrustId = buy_cb.result.data.entrustId;
                  lastUserIndex = buy_order.userIndex;
                  console.log("委托买入成功 ===> " + JSON.stringify(buy_cb));
                } else {
                  console.log("委托买入失败 ===> " + JSON.stringify(buy_cb));
                }
              })
            }
          } else if (body.data.type == 'BUY') {
            if (body.data.statusType == ORDER_FINISH) {
              // 买入完成
              lastEntrustId = null;
              lastAction = null;
              console.log("委托买入完成 ===> " + JSON.stringify(buy_cb));
            }
          }
        }
      })
    })
  } else {
    // 没有委托单，开始卖单
    async.waterfall([
      function (callback) {
        getSellPrice((sell_price) => {
          if (sell_price.price) {
            callback(null, sell_price);
          } else {
            callback('没找到合适的价格区间', null);
          }
        })
      },
      function (sell_price, callback) {
        var sell_order = {
          price: sell_price.price,
          count: sell_price.count,
          userIndex: lastUserIndex
        }
        placeLimitOrder(sell_order, SELL, (sell_cb) => {
          console.log("sell_cb ===> " + JSON.stringify(sell_cb));
          if (sell_cb.success && sell_cb.result.code == 200) {
            // 委托成功
            lastAction = SELL;
            lastEntrustId = sell_cb.result.data[0].entrustId;
            callback(null, sell_cb);
          } else {
            callback('sell_faild', sell_cb);
          }
        })
      }
    ], function (error, results) {
      if (error) {
        console.log("error ===> " + JSON.stringify(error));
      } else {
        console.log("results ===> " + JSON.stringify(results));
      }
    })
  }
}





// 0-买  1-卖
function placeLimitOrder(order, type, callback) {
  let post_data = {
    secretKey: settings.asiaex[order.userIndex].secret_key,
    type: type,
    pairname: PAIRENAME,
    price: String(order.price),
    count: String(order.count)
  }
  signature.asiaex(post_data, settings.asiaex[order.userIndex].public_key, (cb) => {
    //logger.info(type + " signature ===>" + JSON.stringify(cb));
    let post_body = {
      apiKey: settings.asiaex[order.userIndex].api_key,
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
        console.log("limitOrder error ===> " + JSON.stringify(err));
        callback({
          success: false,
          result: err
        });
      } else {
        console.log("limitOrder cb ===>" + JSON.stringify(body));
        callback({
          success: true,
          result: body
        });
      }
    })
  })
}

function getSellPrice(callback) {
  let get_option = {
    url: 'https://www.bitasiabit.com/app/v1/getFullDepthCus?pairname=' + PAIRENAME,
    method: 'get'
  }
  request(get_option, (err, response, body) => {
    if (err) {
      console.log("获取价格接口异常 ===>" + JSON.stringify(err));
      callback({});
    } else {
      var ret = JSON.parse(body);
      var low_asks_price = ret.data.asks[0][0];
      var high_bids_price = ret.data.bids[0][0];
      if (low_asks_price > high_bids_price) {
        // 有价格范围
        let sub = ((low_asks_price - high_bids_price) / 2).toFixed(3);
        callback({
          price: parseFloat(high_bids_price) + parseFloat(sub),
          count: (Math.random() * (MAX_COUNT - MIN_COUNT) + 1).toFixed(6)
        })
      } else {
        callback({});
      }
    }
  })
}