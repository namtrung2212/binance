
const AutoBot = require("./AutoBot");
const BinanceAPI = require("./BinanceAPI");


var root = {};

root.botConfigs = [

    // { trade: "BTC", base: "USDT", Interval: 30 },
    { trade: "ETH", base: "USDT", Interval: 30 },
    { trade: "LTC", base: "USDT", Interval: 30 },
    { trade: "BNB", base: "USDT", Interval: 30 },
    { trade: "NEO", base: "USDT", Interval: 30 },
    { trade: "BCC", base: "USDT", Interval: 30 }


    // { trade: "EVX", base: "BTC", Interval: 30 },
    // { trade: "TRX", base: "BTC", Interval: 30 },
    // { trade: "MANA", base: "BTC", Interval: 30 },
    // { trade: "BQX", base: "BTC", Interval: 30 },
    // { trade: "POE", base: "BTC", Interval: 30 },
    // { trade: "BRD", base: "BTC", Interval: 30 },

    // { trade: "XRP", base: "BTC", Interval: 30 },
    // { trade: "ETC", base: "BTC", Interval: 30 },
    // { trade: "XVG", base: "BTC", Interval: 30 },
    // { trade: "ADA", base: "BTC", Interval: 30 },
    // { trade: "CTR", base: "BTC", Interval: 30 },
    // { trade: "AMB", base: "BTC", Interval: 30 },
    // { trade: "SNT", base: "BTC", Interval: 30 }

    // { trade: "XRP", base: "ETH", Interval: 30 },
    // { trade: "ETC", base: "ETH", Interval: 30 }

];

var API = new BinanceAPI();
API.getTradeConfigs("BTC").then(function (currencies) {
    currencies.forEach(function (curr) {
        root.botConfigs.push(curr)
    });

});

root.config = {

    BUY_SIGNAL: 0.7,
    SELL_SIGNAL: 0.7,

    BUY_MINPERIOD: 1,
    SELL_MINPERIOD: 1,
    SELL_MAXPERIOD: 1,

    redisPort: "6379",
    redisHost: "localhost"
};

root.Bots = [];

root.start = function () {
    console.log("----------------------------------------------------------------------");
    setTimeout(this.timerHandler, 1000 * 2, this, 0);
};

root.timerHandler = async function (root, current) {

    if (current < 0 || current >= root.botConfigs.length)
        return;

    var bot = new AutoBot(root, current);
    bot.start();
    root.Bots.push(bot);
    setTimeout(root.timerHandler, 1000 * 10, root, current + 1);
};

root.start();
