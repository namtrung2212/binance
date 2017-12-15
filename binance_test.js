

const BinanceAPI = require("./BinanceAPI");

var API = new BinanceAPI("USDT", "BTC");


// API.getTotalBalanceInBase().then(function (obj) {

//     console.log(obj);
// });

// API.getTotalBalanceInBase("USDT").then(function (obj) {

//     console.log(obj);
// });


API.roundByStepLimit(0.01453623434343).then(function (obj) {

    console.log(obj);
});

