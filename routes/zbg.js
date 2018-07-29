var express = require('express');
var router = express.Router();
var request = require('request');
var signature = require('../utils/signature');
var settings = require('../settings');
var async = require('async');


router.post('/getByWebId', (req, res, next) => {
  let currTime = Date.now();
  signature.zbg(settings.zbg["azhe"], currTime, '', false, (cb) => {
    console.log(cb);
    let post_options = {
      url: 'https://api.zbg.com/exchange/config/controller/website/marketcontroller/getByWebId',
      method: 'post',
      // headers: {
      //   Apiid: settings.zbg.access_id,
      //   Timestamp: currTime,
      //   Sign: cb.signature
      // },
      json: true,
    }
    request(post_options, (err, response, body) => {
      if (err) {

      } else {
        res.json(body);
      }
    })
  })
})

router.post('/getCurrencyList', (req, res, next) => {
  let currTime = Date.now();
  signature.zbg(settings.zbg["azhe"], currTime, '', false, (cb) => {
    console.log(cb);
    let post_options = {
      url: 'https://api.zbg.com/exchange/config/controller/website/currencycontroller/getCurrencyList',
      method: 'post',
      headers: {
        Apiid: settings.zbg["azhe"].access_id,
        Timestamp: currTime,
        Sign: cb.signature
      },
      json: true,
    }
    request(post_options, (err, response, body) => {
      if (err) {

      } else {
        res.json(body);
      }
    })
  })
})

router.post('/getuserinfo', (req, res, next) => {
  let currTime = Date.now();
  signature.zbg(settings.zbg["azhe"], currTime, '', false, (cb) => {
    console.log(cb);
    let post_options = {
      url: 'https://api.zbg.com/exchange/user/controller/website/usercontroller/getuserinfo',
      method: 'post',
      headers: {
        Apiid: settings.zbg["azhe"].access_id,
        Timestamp: currTime,
        Sign: cb.signature
      },
      json: true,
    }
    request(post_options, (err, response, body) => {
      if (err) {

      } else {
        res.json(body);
      }
    })
  })
})

router.post('/findbypage', (req, res, next) => {
  let currTime = Date.now();
  let postBody = {
    "pageSize": "",
    "pageNum": ""
  }
  let user = req.body.user;
  signature.zbg(settings.zbg[user], currTime, postBody, true, (cb) => {
    let post_options = {
      url: 'https://api.zbg.com/exchange/fund/controller/website/fundcontroller/findbypage',
      method: 'post',
      headers: {
        Apiid: settings.zbg[user].access_id,
        Timestamp: currTime,
        Sign: cb.signature
      },
      json: true,
      body: postBody
    }
    request(post_options, (err, response, body) => {
      if (err) {

      } else {
        var balance = [];
        var index = 0;
        do {
          var obj = body.datas.list[index];
          console.log(obj);
          if (obj.currencyTypeId == 22) {
            balance.push({
              zt: obj.amount
            })
          } else if (obj.currencyTypeId == 11) {
            balance.push({
              usdt: obj.amount
            })
          }
          index++;
        } while (balance.length < 2);
        res.json(balance);
      }
    })
  })
})

router.post('/placeOrder', (req, res, next) => {
  let currTime = Date.now();
  let user = req.body.user; // 先买的用户id
  let postBody = {
    "amount": req.body.amount, //下单数量 
    "rangeType": 0, //区间委托类型 0 为限价委托 1 区间委托，目前暂时只支持限价委托
    "type": 1, //买卖类型：0 卖出 1 购买
    "marketId": req.body.market, //市场ID
    "price": req.body.price
  }
  var result = '';
  signature.zbg(settings.zbg[user], currTime, postBody, true, (cb) => {
    let post_options = {
      url: 'https://api.zbg.com/exchange/entrust/controller/website/EntrustController/addEntrust',
      method: 'post',
      headers: {
        Apiid: settings.zbg[user].access_id,
        Timestamp: currTime,
        Sign: cb.signature
      },
      json: true,
      body: postBody
    }
    request(post_options, (err, response, body) => {
      if (err) {
        res.json({
          success: false,
          msg: "[委托买入失败]" + err
        });
      } else {
        if (body.resMsg.code == "1") {
          result += "[买入" + body.datas.entrustId + "]";
          // 如果成功，马上买入
          let nowTime = Date.now();
          postBody.type = 0;
          user = user == settings.zbg.length - 1 ? 0 : parseInt(user) + 1;
          signature.zbg(settings.zbg[user], nowTime, postBody, true, (sign) => {
            let buy_options = {
              url: 'https://api.zbg.com/exchange/entrust/controller/website/EntrustController/addEntrust',
              method: 'post',
              headers: {
                Apiid: settings.zbg[user].access_id,
                Timestamp: nowTime,
                Sign: sign.signature
              },
              json: true,
              body: postBody
            }
            request(buy_options, (error, buy_response, buy_body) => {
              if (error) {
                res.json({
                  success: false,
                  msg: result + " [委托卖出失败]" + error
                });
              } else {
                if (buy_body.resMsg.code == "1") {
                  res.json({
                    success: true,
                    msg: result + " [卖出" + buy_body.datas.entrustId + "] "
                  });
                } else {
                  res.json({
                    success: false,
                    msg: result + buy_body.resMsg.message
                  })
                }
              }
            })
          })
        } else {
          res.json({
            success: false,
            msg: body.resMsg.message
          })
        }
      }
    })
  })
})

router.post('/addEntrust', (req, res, next) => {
  let currTime = Date.now();
  let postBody = {
    "amount": 100, //下单数量 
    "rangeType": 0, //区间委托类型 0 为限价委托 1 区间委托，目前暂时只支持限价委托
    "type": 0, //买卖类型：0 卖出 1 购买
    "marketId": "90", //市场ID
    "price": 0.0001
  }
  signature.zbg(settings.zbg[0], currTime, postBody, true, (cb) => {
    let post_options = {
      url: 'https://api.zbg.com/exchange/user/controller/website/usercontroller/getuserinfo',
      method: 'post',
      headers: {
        Apiid: settings.zbg[0].access_id,
        Timestamp: currTime,
        Sign: cb.signature
      },
      json: true,
      body: postBody
    }
    request(post_options, (err, response, body) => {
      if (err) {

      } else {
        res.json(body);
      }
    })
  })
})

router.post('/findbypage', (req, res, next) => {
  let currTime = Date.now();
  let postBody = {
    "pageSize": 30,
    "pageNum": 1
  }
  signature.zbg(settings.zbg[0], currTime, postBody, true, (cb) => {
    let post_options = {
      url: 'https://api.zbg.com/exchange/fund/controller/website/fundcontroller/findbypage',
      method: 'post',
      headers: {
        Apiid: settings.zbg[0].access_id,
        Timestamp: currTime,
        Sign: cb.signature
      },
      json: true,
      body: postBody
    }
    request(post_options, (err, response, body) => {
      if (err) {

      } else {
        res.json(body);
      }
    })
  })
})

module.exports = router;