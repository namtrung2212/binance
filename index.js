
const AutoBot = require("./AutoBot");

var botsArr = [
    { trade: "BTC", base: "USDT" },
    { trade: "ETH", base: "USDT" },
    { trade: "LTC", base: "USDT" },
    { trade: "BNB", base: "USDT" }

    // { trade: "XRP", base: "BTC" },
    // { trade: "ETC", base: "BTC" },
    // { trade: "XVG", base: "BTC" },
    // { trade: "ADA", base: "BTC" },
    // { trade: "TRX", base: "BTC" },
    // { trade: "POE", base: "BTC" },
    // { trade: "CTR", base: "BTC" },
    // { trade: "AMB", base: "BTC" },
    // { trade: "SNT", base: "BTC" },

    // { trade: "XRP", base: "ETH" },
    // { trade: "ETC", base: "ETH" }

];

var root = {};
root.bots = [];

root.start = function (botsArr) {

    console.log("----------------------------------------------------------------------");
    setTimeout(this.timerHandler, 1000 * 2, botsArr, 0, this);
};
root.timerHandler = async function (botsArr, current, root) {

    if (current < 0 || current >= botsArr.length)
        return;

    var bot = new AutoBot(botsArr[current].trade, botsArr[current].base, "30m", 30);
    bot.init(root, "6379", "localhost");
    bot.start();

    root.bots.push(bot);

    setTimeout(root.timerHandler, 1000 * 10, botsArr, current + 1, root);
};

root.start(botsArr);
