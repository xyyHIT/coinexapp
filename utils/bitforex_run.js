var request = require('request');
var signature = require('../utils/signature');
var settings = require('../settings');
var log4js = require('log4js');
log4js.configure(settings.log4js);
var logger = log4js.getLogger(__filename);
var async = require('async');

var args = process.argv.splice(2);
console.log(args);

var market = args[0];
var userIndex = args[1];
var amount = args[2];

deal((deal_cb) => {
  console.log(JSON.stringify(deal_cb));
  console.log(" ------ 本次处理结束 -----------");
})

function deal(deal_cb) {
  if (userIndex && (userIndex == 0 || userIndex == 1) && market && (market == 'btc' || market == 'bch' || market == 'eth')) {
    async.waterfall([
      // 查询合适的价格
      function (callback) {
        getMatchPrice((price_cb) => {
          if (price_cb.success) {
            callback(null, price_cb.price);
          } else {
            callback('未找到匹配价格', null);
          }
        })
      },
      // 用户下单
      function (price, callback) {
        dealOrder(userIndex, price, (deal_order_cb) => {
          if (deal_order_cb.success) {
            userIndex = userIndex == settings.bitforex.length - 1 ? 0 : userIndex + 1
            callback(null, deal_order_cb.msg);
          } else {
            callback(deal_order_cb.msg, null);
          }
        })
      }
    ], function (error, result) {
      if (error) {
        deal_cb({
          success: false,
          msg: error
        });
      } else {
        deal_cb({
          success: true,
          msg: result
        });
      }
    })
  } else {
    deal_cb({
      success: false,
      msg: '参数错误'
    });
  }

}

function getMatchPrice(price_cb) {
  let options = {
    url: 'https://api.bitforex.com/api/v1/market/ticker?symbol=' + 'coin-usdt-' + market,
    method: 'get',
    json: true,
  }
  request(options, (err, response, body) => {
    if (err) {
      price_cb({
        success: false
      })
    } else {
      var min_sell = body.data.sell;
      var max_buy = body.data.buy;
      var sub = min_sell - max_buy;
      if (sub > 0) {
        var price = min_sell + parseFloat((sub / 2).toFixed(4));
        console.log(min_sell + " " + price + " " + max_buy);
        price_cb({
          success: true,
          price: price
        })
      } else {
        price_cb({
          success: false
        })
      }
    }
  })
}

function dealOrder(user, price, deal_order_cb) {
  let currTime = Date.now();
  let deal_count = amount * 0.99;
  let post_sell = {
    accessKey: settings.bitforex[user].access_id,
    amount: deal_count, //下单数量 
    nonce: currTime,
    price: price,
    symbol: 'coin-usdt-' + market,
    tradeType: 2 //买卖类型：1、买入，2、卖出
  }
  var result = '';
  signature.bitforex(settings.bitforex[user].secret_key, '/api/v1/trade/placeOrder?', post_sell, true, (cb) => {
    let post_options = {
      url: 'https://api.bitforex.com' + cb.signature,
      method: 'post',
      json: true
    }
    request(post_options, (err, response, body) => {
      if (err) {
        res.json({
          success: false,
          msg: "[委托买入失败]" + err
        });
      } else {
        if (body.success) {
          result += "[买入" + body.orderId + "]";
          // 如果成功，马上买入
          let post_buy = {
            accessKey: settings.bitforex[user].access_id,
            amount: deal_count / price, //下单数量 
            nonce: currTime,
            price: price,
            symbol: 'coin-usdt-' + market,
            tradeType: 1 //1、买入，2、卖出
          }
          user = user == settings.bitforex.length - 1 ? 0 : parseInt(user) + 1;
          signature.bitforex(settings.bitforex[user].secret_key, '/api/v1/trade/placeOrder?', post_buy, true, (sign) => {
            let buy_options = {
              url: 'https://api.bitforex.com' + sign.signature,
              method: 'post',
              json: true
            }
            request(buy_options, (error, buy_response, buy_body) => {
              if (error) {
                deal_order_cb({
                  success: false,
                  msg: result + " [委托卖出失败]" + error
                });
              } else {
                if (buy_body.success) {
                  deal_order_cb({
                    success: true,
                    msg: result + " [卖出" + buy_body.orderId + "] "
                  });
                } else {
                  deal_order_cb({
                    success: false,
                    msg: result + " [委托卖出失败]"
                  })
                }
              }
            })
          })
        } else {
          deal_order_cb({
            success: false,
            msg: body
          })
        }
      }
    })
  })
}

function queryUSDT(user, usdt_cb) {
  let currTime = Date.now();
  var post_data = {
    accessKey: setting.bitforex[user].access_id,
    nonce: currTime
  }
  signature.bitforex(setting.bitforex[user].secret_key, '/api/v1/fund/allAccount?', post_data, true, (cb) => {
    let post_options = {
      url: 'https://api.bitforex.com' + cb.signature,
      method: 'post',
      json: true
    }
    request(post_options, (err, response, body) => {
      console.log(JSON.stringify(body));
      for (let index in body.data) {
        var obj = body.data[index];
        if (obj.currency == 'usdt') {
          usdt_cb(obj);
        }
      }
    })
  })
}