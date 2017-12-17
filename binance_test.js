

const BinanceAPI = require("./BinanceAPI");

//var API = new BinanceAPI("XRP", "BTC");


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


var columnify = require('columnify');

let data = [{

    Time: moment().utcOffset(7).format("YYYY-MM-DD HH:mm"),
    Type: "BUY",
    Qty: 24.234325,
    Coin: "BTC",
    Price: 0.02337964,
    Ex: "BTC/USDT"

}, {

    Time: moment().utcOffset(7).format("YYYY-MM-DD HH:mm"),
    Type: "BUY",
    Qty: 34.2343,
    Coin: "BTC",
    Price: 0.02364,
    Ex: "BTC/USD"

}];
var columns = columnify(data, {
    showHeaders: false,
    config: {
        Type: {
            align: 'center',
            minWidth: 5,
            maxWidth: 10
        },
        Qty: {
            align: 'right',
            minWidth: 15
        },
        Coin: {
            align: 'center'
        },
        Price: {
            align: 'right',
            minWidth: 15
        },
        Ex: {
            align: 'center'
        }
    }

});
console.log(columns);