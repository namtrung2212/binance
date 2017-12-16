
const AutoBot = require("./AutoBot");

var bots = [
    { trade: "BTC", base: "USDT" },
    { trade: "ETH", base: "USDT" },
    { trade: "LTC", base: "USDT" },
    { trade: "BNB", base: "USDT" },
    //  { trade: "XRP", base: "USDT" },

    // { trade: "ETH", base: "BTC" },
    // { trade: "LTC", base: "BTC" },
    { trade: "XRP", base: "BTC" },
    { trade: "ETC", base: "BTC" },
    // { trade: "BNB", base: "BTC" },

    // { trade: "LTC", base: "ETH" },
    { trade: "XRP", base: "ETH" },
    { trade: "ETC", base: "ETH" }
    //{ trade: "BNB", base: "ETH" }

    //  { trade: "XRP", base: "LTC" }
];

var root = {};

root.start = function (bots) {

    setTimeout(this.timerHandler, 1000 * 2, bots, 0, this);
};

root.timerHandler = async function (bots, current, root) {

    if (current < 0 || current >= bots.length)
        return;

    var bot = new AutoBot(bots[current].trade, bots[current].base, "1m", 30);
    bot.initRedis("6379", "localhost");
    bot.start();

    setTimeout(root.timerHandler, 1000 * 10, bots, current + 1, root);
};

root.start(bots);
