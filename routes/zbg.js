var express = require('express');
var router = express.Router();
var request = require('request');
var signature = require('../utils/signature');
var settings = require('../settings');


router.post('/getByWebId', (req, res, next) => {
  let currTime = Date.now();
  signature.zbg(currTime, '', false, (cb) => {
    console.log(cb);
    let post_options = {
      url: 'https://www.zbg.com//exchange/config/controller/website/marketcontroller/getByWebId',
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
  signature.zbg(currTime, '', false, (cb) => {
    console.log(cb);
    let post_options = {
      url: 'https://www.zbg.com/exchange/config/controller/website/currencycontroller/getCurrencyList',
      method: 'post',
      headers: {
        Apiid: settings.zbg.access_id,
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
  signature.zbg(currTime, '', false, (cb) => {
    console.log(cb);
    let post_options = {
      url: 'https://www.zbg.com/exchange/user/controller/website/usercontroller/getuserinfo',
      method: 'post',
      headers: {
        Apiid: settings.zbg.access_id,
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

router.post('/addEntrust', (req, res, next) => {
  let currTime = Date.now();
  let postBody = {
    "amount": 100,                          //下单数量 
    "rangeType": 0,                       //区间委托类型 0 为限价委托 1 区间委托，目前暂时只支持限价委托
    "type": 0,                            //买卖类型：0 卖出 1 购买
    "marketId": "90",                     //市场ID
    "price": 0.0001 
  }
  signature.zbg(currTime, postBody, true, (cb) => {
    let post_options = {
      url: 'https://www.zbg.com/exchange/user/controller/website/usercontroller/getuserinfo',
      method: 'post',
      headers: {
        Apiid: settings.zbg.access_id,
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
    "pageSize":30,       
    "pageNum":1      
  }
  signature.zbg(currTime, postBody, true, (cb) => {
    let post_options = {
      url: 'https://www.zbg.com/exchange/fund/controller/website/fundcontroller/findbypage',
      method: 'post',
      headers: {
        Apiid: settings.zbg.access_id,
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

router.get('/getUserEntrustRecordFromCache', (req, res, next) => {
  let currTime = Date.now();
  signature.zbg(currTime, 'marketId90', false, (cb) => {
    let get_options = {
      url: 'https://www.zbg.com/exchange/entrust/controller/website/EntrustController/getUserEntrustRecordFromCache?marketId=90',
      method: 'get',
      headers: {
        Apiid: settings.zbg.access_id,
        Timestamp: currTime,
        Sign: cb.signature
      },
      json: true
    }
    request(get_options, (err, response, body) => {
      if (err) {

      } else {
        res.json(body);
      }
    })
  })
})

module.exports = router;