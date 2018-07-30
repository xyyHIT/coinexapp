var request = require('request');
var signature = require('../utils/signature');
var settings = require('../settings');
var log4js = require('log4js');
log4js.configure(settings.log4js);
var logger = log4js.getLogger(__filename);
var async = require('async');

// var json = {"userId":"u111","name":"zhangsan"};
// let currTime = Date.now();
// signature.zbg(currTime, json, true, function(cb) {
//   console.log(cb);
// })
// chargeBalance({}, function (callback) {
//   console.log(callback)
// })
var lastTimestamp = 0;
var lastHourCount = 0;
var maxHortCount = 10;
setInterval(intervalFunc, 1000);

function intervalFunc() {
  var callTime = Date.now() / 1000;
  if (callTime - lastTimestamp >= 20) {
    var date_call_time = new Date(callTime * 1000);
    var year = date_call_time.getFullYear();
    var month = date_call_time.getMonth() + 1;
    var date = date_call_time.getDate();
    var hour = date_call_time.getHours();
    var min = date_call_time.getMinutes();
    var sec = date_call_time.getSeconds();
    var stringTime = [year, month, date].join('-') + " " + hour + ":" + min + ":" + sec;
    lastTimestamp = Date.parse(new Date(stringTime)) / 1000;
    lastHourCount = 0;
  }
  if (lastHourCount < maxHortCount) {
    console.log("lastHourCount ===> " + lastHourCount);
    console.log("lastTimestamp ===> " + lastTimestamp);
    lastHourCount += 1;
  } else {
    console.log(new Date(lastTimestamp * 1000).toLocaleString() + " " + lastHourCount);
  }
}