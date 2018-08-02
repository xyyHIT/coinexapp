var express = require('express');
var router = express.Router();
var request = require('request');
var signature = require('../utils/signature');
var settings = require('../settings');
var async = require('async');

var currency_arr = ["usdt", "btc", "bch", "eth"];

router.get('/market/symbols', (req, res, next) => {
  var options = {
    url: 'https://api.bitforex.com/api/v1/market/symbols',
    method: 'get',
    json: true
  }
  request(options, (err, response, body) => {
    if (err) {

    } else {
      res.json(body);
    }
  })
})

router.get('/fund/mainAccount', (req, res, next) => {
  let currTime = Date.now();
  var post_data = {
    accessKey: settings.bitforex[0].access_id,
    currency: req.query.currency,
    nonce: currTime
  }
  signature.bitforex(settings.bitforex[0].secret_key, '/api/v1/fund/mainAccount?', post_data, true, (cb) => {
    console.log(JSON.stringify(cb));
    let post_options = {
      url: 'https://api.bitforex.com' + cb.signature,
      method: 'post',
      json: true
    }
    request(post_options, (err, response, body) => {
      if (err) {

      } else {
        res.json(body);
      }
    })
  })
})

router.get('/myBalance', (req, res, next) => {
  async.mapSeries(settings.bitforex, function (user, callback) {
      queryBalance(user, (balance_cb) => {
        callback(null, balance_cb);
      })
    },
    function (error, results) {
      res.json(results);
    })
})

function queryBalance(user, balance_cb) {
  let currTime = Date.now();
  var post_data = {
    accessKey: settings.bitforex[user].access_id,
    nonce: currTime
  }
  signature.bitforex(settings.bitforex[user].secret_key, '/api/v1/fund/allAccount?', post_data, true, (cb) => {
    let post_options = {
      url: 'https://api.bitforex.com' + cb.signature,
      method: 'post',
      json: true
    }
    request(post_options, (err, response, body) => {
      console.log(JSON.stringify(body));
      var balance = [];
      for (let index in body.data) {
        var obj = body.data[index];
        if (obj.currency == 'btc') {
          balance.push({
            btc: {
              active: obj.active,
              frozen: obj.frozen
            }
          })
        } else if (obj.currency == 'usdt') {
          balance.push({
            usdt: {
              active: obj.active,
              frozen: obj.frozen
            }
          })
        } else if (obj.currency == 'eth') {
          balance.push({
            eth: {
              active: obj.active,
              frozen: obj.frozen
            }
          })
        } else if (obj.currency == 'bch') {
          balance.push({
            bth: {
              active: obj.active,
              frozen: obj.frozen
            }
          })
        }
      }
      balance_cb(balance);
    })
  })
}

router.post('/placeOrder', (req, res, next) => {
  let currTime = Date.now();
  let user = req.body.user; // 先买的用户id
  let postBody = {
    accessKey: settings.bitforex[user].access_id,
    amount: req.body.amount, //下单数量 
    nonce: currTime,
    price: req.body.price,
    symbol: req.body.market,
    tradeType: 1 //买卖类型：0 卖出 1 购买
  }
  var result = '';
  signature.bitforex(settings.zbg[user].secret_key, '/api/v1/trade/placeOrder', postBody, true, (cb) => {
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
          let nowTime = Date.now();
          postBody.type = 0;
          user = user == settings.bitforex.length - 1 ? 0 : parseInt(user) + 1;
          signature.bitforex(settings.zbg[user].secret_key, '/api/v1/trade/placeOrder', postBody, true, (sign) => {
            let buy_options = {
              url: 'https://api.bitforex.com' + sign.signature,
              method: 'post',
              json: true
            }
            request(buy_options, (error, buy_response, buy_body) => {
              if (error) {
                res.json({
                  success: false,
                  msg: result + " [委托卖出失败]" + error
                });
              } else {
                if (buy_body.success) {
                  res.json({
                    success: true,
                    msg: result + " [卖出" + buy_body.orderId + "] "
                  });
                } else {
                  res.json({
                    success: false,
                    msg: result + " [委托卖出失败]"
                  })
                }
              }
            })
          })
        } else {
          res.json({
            success: false,
            msg: body
          })
        }
      }
    })
  })
})

module.exports = router;