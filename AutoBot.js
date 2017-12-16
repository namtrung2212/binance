
var moment = require('moment');
var format = require('string-format');
var MACD = require('technicalindicators').MACD;

const RedisClient = require('redis');
const BinanceAPI = require("./BinanceAPI");

function AutoBot(tradeCur, baseCur, tradeWeight, MACDInput, interval) {

    this.BaseCurrency = baseCur;
    this.TradeCurrency = tradeCur;
    this.Symbol = this.TradeCurrency + this.BaseCurrency;

    this.TradeWeight = tradeWeight;

    this.MACDInput = MACDInput;

    this.IntervalMinute = interval;

    this.API = new BinanceAPI(this.TradeCurrency, this.BaseCurrency);

};

module.exports = AutoBot;

AutoBot.prototype.initRedis = function (port, host) {

    this.caching = RedisClient.createClient(port, host);
    // this.caching.flushall();
    this.caching.on("error", function (err) {
        console.log(err);
        console.error(err.stack);
    });

};

AutoBot.prototype.start = function () {

    console.log("Start : " + this.Symbol + " with WEIGHT = " + this.TradeWeight * 100 + "% & MACD = " + this.MACDInput);

    setTimeout(this.timerHandler, 1000 * 60 * this.IntervalMinute, this);
};

AutoBot.prototype.timerHandler = async function (bot) {

    await bot.handler();

    setTimeout(bot.timerHandler, 1000 * 60 * bot.IntervalMinute, bot);
};

AutoBot.prototype.handler = async function () {

    if (await this.shouldToBUY()) {

        let suggest = await this.suggestBuyPrice();
        if (suggest) {
            let newOrder = await this.API.buy(suggest.amount, suggest.price);

            console.log("----------------------------------------------------");
            var str = format("[{0} {1}] BUY {2} {3} at {4} {5}/{6}",
                moment().utcOffset(12).format("YYYY-MM-DD HH:mm"),
                this.BaseCurrency,
                suggest.amount, this.TradeCurrency,
                suggest.price, this.TradeCurrency, this.BaseCurrency)
                .toString();

            console.log(str);
            console.log(JSON.stringify(newOrder));


        }
    }

    if (await this.shouldToSELL()) {

        let suggest = await this.suggestSellPrice();
        if (suggest) {

            let newOrder = await this.API.sell(suggest.amount, suggest.price);


            console.log("----------------------------------------------------");
            var str = format("[{0} {1}] SELL {2} {3} at {4} {5}/{6}",
                moment().utcOffset(12).format("YYYY-MM-DD HH:mm"),
                this.BaseCurrency,
                suggest.amount, this.TradeCurrency,
                suggest.price, this.TradeCurrency, this.BaseCurrency)
                .toString();

            console.log(str);
            console.log(JSON.stringify(newOrder));
        }

    }
};

AutoBot.prototype.MACD = async function (histories) {

    return new Promise((resolve) => {

        var _this = this;

        var macdInput = {
            values: histories.prices,
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
            SimpleMAOscillator: false,
            SimpleMASignal: false
        }

        let macdOutput = MACD.calculate(macdInput);

        resolve(macdOutput);
    });
};

AutoBot.prototype.shouldToBUY = async function () {

    var that = this;
    return new Promise(async function (resolve) {

        let baseBal = await that.API.getBalance(that.BaseCurrency);
        let tradedBal = await that.API.getBalance(that.TradeCurrency);

        let tradedInBase = await that.API.convertTo(tradedBal, that.TradeCurrency, that.BaseCurrency);
        let totalInBase = await that.API.getTotalBalanceInBase(that.BaseCurrency);

        let maxTradeInBase = that.TradeWeight * totalInBase;

        // KHONG DUOC QUA GIOI HAN
        if (baseBal <= 0 || totalInBase <= 0 || (tradedInBase >= maxTradeInBase)) {
            resolve(false);
            return;
        }

        let wannaTradeInBase = maxTradeInBase - tradedInBase;
        let wannaTrade = await that.API.convertTo(wannaTradeInBase, that.BaseCurrency, that.TradeCurrency);

        // THIEU TIEN BASE_CURRENCY
        let minTrade = await that.API.getMinTradeAmount();
        if (wannaTrade < minTrade) {
            resolve(false);
            return;
        }

        var histories = await that.API.chartHistory(that.MACDInput);
        var macd = await that.MACD(histories);
        if (!macd || macd.length < 10 || macd[macd.length - 1].histogram < 0) {
            resolve(false);
            return;
        }

        var firstRight;
        var firstRightIndex;
        for (var i = macd.length - 1; i >= 0; i--) {
            if (macd[i].histogram && macd[i].histogram >= 0) {
                firstRight = macd[i];
                firstRightIndex = i;
            } else {
                break;
            }
        }
        if (!firstRight) {
            resolve(false);
            return;
        }

        var lastLeftIndex = firstRightIndex - 1;
        var lastLeft = macd[lastLeftIndex];

        var leftAverage = 0;
        leftAverage += Math.abs(macd[lastLeftIndex].histogram);
        leftAverage += Math.abs(macd[lastLeftIndex - 1].histogram);
        leftAverage += Math.abs(macd[lastLeftIndex - 2].histogram);
        leftAverage = leftAverage / 3;

        var rightAverage = Math.abs(macd[macd.length - 1].histogram);

        let percent = leftAverage / (leftAverage + rightAverage);

        let result = percent < 0.45;

        if (result) {

            console.log("------- SHOULD BUY -------");
            console.log("leftAverage = " + leftAverage);
            console.log("rightAverage = " + rightAverage);
            console.log("percent = " + percent);
            console.log("");
        }

        resolve(result);
    });
};

AutoBot.prototype.shouldToSELL = async function () {

    var that = this;
    return new Promise(async function (resolve) {

        let tradedBal = await that.API.getBalance(that.TradeCurrency);
        if (tradedBal <= 0) {
            resolve(false);
            return;
        }

        let minTrade = await that.API.getMinTradeAmount();
        let wannaTrade = tradedBal;

        // CON IT TIEN TRADE_CURRENCY
        if (wannaTrade < minTrade) {
            resolve(false);
            return;
        }

        var histories = await that.API.chartHistory(that.MACDInput);
        var macd = await that.MACD(histories);

        if (!macd || macd.length < 10 || macd[macd.length - 1].histogram >= 0) {
            resolve(false);
            return;
        }

        var firstRight;
        var firstRightIndex;
        for (var i = macd.length - 1; i >= 0; i--) {
            if (macd[i].histogram && macd[i].histogram < 0) {
                firstRight = macd[i];
                firstRightIndex = i;
            } else {
                break;
            }
        }
        if (!firstRight) {
            resolve(false);
            return;
        }

        var lastLeftIndex = firstRightIndex - 1;
        var lastLeft = macd[lastLeftIndex];

        var leftAverage = 0;
        leftAverage += Math.abs(macd[lastLeftIndex].histogram);
        leftAverage += Math.abs(macd[lastLeftIndex - 1].histogram);
        leftAverage += Math.abs(macd[lastLeftIndex - 2].histogram);
        leftAverage = leftAverage / 3;

        var rightAverage = Math.abs(macd[macd.length - 1].histogram);

        let percent = leftAverage / (leftAverage + rightAverage);

        let result = percent < 0.45;

        if (result) {

            console.log("------- SHOULD SELL -------");
            console.log("leftAverage = " + leftAverage);
            console.log("rightAverage = " + rightAverage);
            console.log("percent = " + percent);
            console.log("");
        }

        resolve(result);
    });
};

AutoBot.prototype.suggestBuyPrice = async function () {

    let baseBal = await this.API.getBalance(this.BaseCurrency);
    let tradedBal = await this.API.getBalance(this.TradeCurrency);

    let tradedInBase = await this.API.convertTo(tradedBal, this.TradeCurrency, this.BaseCurrency);
    let totalInBase = await this.API.getTotalBalanceInBase(this.BaseCurrency);

    let maxTradeInBase = this.TradeWeight * totalInBase;

    // KHONG DUOC QUA GIOI HAN
    if (baseBal <= 0 || totalInBase <= 0 || (tradedInBase >= maxTradeInBase))
        return null;

    let wannaTradeInBase = maxTradeInBase - tradedInBase;
    let wannaTrade = await this.API.convertTo(wannaTradeInBase, this.BaseCurrency, this.TradeCurrency);

    // THIEU TIEN BASE_CURRENCY
    let minTrade = await this.API.getMinTradeAmount();
    if (wannaTrade < minTrade)
        return null;

    let sellings = await this.API.DepthSelling();

    var lowestPrice = 0;
    for (var i = 0; i < 20; i++) {
        let selling = sellings[i];
        if (selling.price) {
            lowestPrice = selling.price;
            break;
        }
    }

    var tradableAmt = 0;

    for (var i = 4; i < 20; i++) {

        let selling = sellings[i];
        if (selling.price) {

            let remain = (wannaTrade - tradableAmt);
            if (remain <= 0)
                break;

            if (selling.amount > remain)
                tradableAmt += remain;
            else
                tradableAmt += selling.amount;

            if (selling.price > lowestPrice)
                lowestPrice = selling.price;

        }
    }

    if (tradableAmt > wannaTrade)
        tradableAmt = wannaTrade;

    let result = await this.API.correctTradeOrder(tradableAmt, lowestPrice);
    return result;
};

AutoBot.prototype.suggestSellPrice = async function () {

    let tradedBal = await this.API.getBalance(this.TradeCurrency);
    if (tradedBal <= 0)
        return null;

    let minTrade = await this.API.getMinTradeAmount();
    let wannaTrade = tradedBal;

    // CON IT TIEN TRADE_CURRENCY
    if (wannaTrade < minTrade)
        return null;

    let buyings = await this.API.DepthBuying();

    var highestPrice = 0;
    for (var i = 0; i < 20; i++) {
        let buying = buyings[i];
        if (buying.price) {
            highestPrice = buying.price;
            break;
        }
    }

    var tradableAmt = 0;

    for (var i = 4; i < 20; i++) {

        let buying = buyings[i];
        if (buying.price) {

            let remain = (wannaTrade - tradableAmt);
            if (remain <= 0)
                break;

            if (buying.amount > remain)
                tradableAmt += remain;
            else
                tradableAmt += buying.amount;

            if (buying.price < highestPrice)
                highestPrice = buying.price;
        }
    }

    if (tradableAmt > wannaTrade)
        tradableAmt = wannaTrade;

    let result = await this.API.correctTradeOrder(tradableAmt, highestPrice);
    return result;
};
