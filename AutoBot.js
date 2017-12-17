
var moment = require('moment');
var format = require('string-format');
var MACD = require('technicalindicators').MACD;

const RedisClient = require('redis');
const BinanceAPI = require("./BinanceAPI");

function AutoBot(tradeCur, baseCur, MACDInput, interval) {

    this.BaseCurrency = baseCur;
    this.TradeCurrency = tradeCur;
    this.Symbol = this.TradeCurrency + this.BaseCurrency;

    this.MACDInput = MACDInput;

    this.IntervalMinute = interval / 60;

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

    console.log("Start : " + this.TradeCurrency + "-" + this.BaseCurrency + " with MACD = " + this.MACDInput);

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

            console.log("----------------------------------------------------------------------");
            var str = format("[{0} {1}] BUY {2} {3} at {4} {5}/{6}",
                moment().utcOffset(7).format("YYYY-MM-DD HH:mm"),
                this.BaseCurrency,
                suggest.amount, this.TradeCurrency,
                suggest.price, this.BaseCurrency, this.TradeCurrency)
                .toString();

            console.log(str);
            // console.log(JSON.stringify(newOrder));


        }
    }

    if (await this.shouldToSELL()) {

        let suggest = await this.suggestSellPrice();
        if (suggest) {

            let newOrder = await this.API.sell(suggest.amount, suggest.price);


            console.log("----------------------------------------------------------------------");
            var str = format("[{0} {1}] SELL {2} {3} at {4} {5}/{6}",
                moment().utcOffset(7).format("YYYY-MM-DD HH:mm"),
                this.BaseCurrency,
                suggest.amount, this.TradeCurrency,
                suggest.price, this.BaseCurrency, this.TradeCurrency)
                .toString();

            console.log(str);
            // console.log(JSON.stringify(newOrder));
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
        let wannaTrade = await that.API.convertTo(baseBal, that.BaseCurrency, that.TradeCurrency);

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

        if (macd[macd.length - 1].histogram < macd[macd.length - 2].histogram) {
            resolve(false);
            return;
        }

        // DUOI 2 LAN TANG LIEN TIEP
        if ((macd.length - 1) - firstRightIndex < 1) {
            resolve(false);
            return;
        }

        var lastLeftIndex = firstRightIndex - 1;
        var lastLeft = macd[lastLeftIndex];

        var leftAverage = Math.abs(macd[lastLeftIndex].histogram);
        var count = 1;
        if (macd[lastLeftIndex - 1].histogram < 0) {
            leftAverage += Math.abs(macd[lastLeftIndex - 1].histogram);
            count++;
        }
        if (macd[lastLeftIndex - 2].histogram < 0) {
            leftAverage += Math.abs(macd[lastLeftIndex - 2].histogram);
            count++;
        }
        leftAverage = leftAverage / count;

        var rightAverage = Math.abs(macd[macd.length - 1].histogram);
        let percent = leftAverage / (leftAverage + rightAverage);

        let result = percent < 0.45;

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

        if (macd[macd.length - 1].histogram >= macd[macd.length - 2].histogram) {
            resolve(false);
            return;
        }

        // 4 LAN GIAM LIEN TIEP -> SELL
        if ((macd.length - 1) - firstRightIndex > 2) {
            resolve(true);
            return;
        }

        var lastLeftIndex = firstRightIndex - 1;
        var lastLeft = macd[lastLeftIndex];

        var leftAverage = Math.abs(macd[lastLeftIndex].histogram);
        var count = 1;
        if (macd[lastLeftIndex - 1].histogram >= 0) {
            leftAverage += Math.abs(macd[lastLeftIndex - 1].histogram);
            count++;
        }
        if (macd[lastLeftIndex - 2].histogram >= 0) {
            leftAverage += Math.abs(macd[lastLeftIndex - 2].histogram);
            count++;
        }
        leftAverage = leftAverage / count;

        var rightAverage = Math.abs(macd[macd.length - 1].histogram);

        let percent = leftAverage / (leftAverage + rightAverage);
        // if (that.TradeCurrency == "BTC" && that.BaseCurrency == "USDT")
        //     console.log("SELL percent = " + percent);

        let result = percent < 0.45;

        resolve(result);
    });
};

AutoBot.prototype.suggestBuyPrice = async function () {

    let baseBal = await this.API.getBalance(this.BaseCurrency);
    let wannaTrade = await this.API.convertTo(baseBal, this.BaseCurrency, this.TradeCurrency);

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

    var firtPrice = lowestPrice;
    var tradableAmt = 0;

    for (var i = 2; i < sellings.length; i++) {

        let selling = sellings[i];
        if (selling.price && selling.price < 0.95 * firtPrice) {

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

    tradableAmt = baseBal / lowestPrice;

    if (tradableAmt > wannaTrade)
        tradableAmt = wannaTrade;

    if (tradableAmt < minTrade)
        return null;

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
    var firtPrice = highestPrice;

    var tradableAmt = 0;

    for (var i = 2; i < buyings.length; i++) {

        let buying = buyings[i];
        if (buying.price && buying.price > 0.95 * firtPrice) {

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
    // if (this.TradeCurrency == "BTC" && this.BaseCurrency == "USDT")
    //     console.log("SELL order = " + result);

    return result;
};
