
const AutoBot = require("./AutoBot");

var root = {};

root.botConfigs = [

    { trade: "BTC", base: "USDT", MACD: "30m", Interval: 30 },
    { trade: "ETH", base: "USDT", MACD: "30m", Interval: 30 },
    { trade: "LTC", base: "USDT", MACD: "30m", Interval: 30 },
    { trade: "BNB", base: "USDT", MACD: "30m", Interval: 30 },
    { trade: "NEO", base: "USDT", MACD: "30m", Interval: 30 },
    { trade: "BCC", base: "USDT", MACD: "30m", Interval: 30 },

    { trade: "XRP", base: "BTC", MACD: "30m", Interval: 30 },
    { trade: "ETC", base: "BTC", MACD: "30m", Interval: 30 },
    { trade: "XVG", base: "BTC", MACD: "30m", Interval: 30 },
    { trade: "ADA", base: "BTC", MACD: "30m", Interval: 30 },
    { trade: "TRX", base: "BTC", MACD: "30m", Interval: 30 },
    { trade: "POE", base: "BTC", MACD: "30m", Interval: 30 },
    { trade: "CTR", base: "BTC", MACD: "30m", Interval: 30 },
    { trade: "AMB", base: "BTC", MACD: "30m", Interval: 30 },
    { trade: "SNT", base: "BTC", MACD: "30m", Interval: 30 },

    { trade: "XRP", base: "ETH", MACD: "30m", Interval: 30 },
    { trade: "ETC", base: "ETH", MACD: "30m", Interval: 30 }

];

root.config = {

    BUY_SIGNAL: 0.75,
    SELL_SIGNAL: 0.7,

    BUY_MINPERIOD: 5,
    SELL_MINPERIOD: 2,
    SELL_MAXPERIOD: 3,

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
