

const BinanceAPI = require("./BinanceAPI");

var API = new BinanceAPI();

API.getTradeConfigs("BTC").then(function (currencies) {

    currencies.forEach(function (curr) {
        console.log(curr);
    });

});


// API.getTotalBalanceInBase().then(function (obj) {

//     console.log(obj);
// });

// API.getTotalBalanceInBase("USDT").then(function (obj) {

//     console.log(obj);
// });


// API.roundByStepLimit(0.01453623434343).then(function (obj) {

//     console.log(obj);
// });

// API.correctTradeOrder(23.234, 0.000342).then(function (obj) {

//     console.log("correctTradeOrder = " + JSON.stringify(obj));
// });

// API.getTradePrecision().then(function (obj) {

//     console.log("getTradePrecision = " + obj);
// });

var moment = require('moment');
// console.log(moment().utcOffset(7).format("YYYY-MM-DD HH:mm"));



// API.getCurrentPrice().then(function (obj) {

//     console.log(obj);
// });

