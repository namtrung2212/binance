
var moment = require('moment');
var format = require('string-format');
var columnify = require('columnify');
var MACD = require('technicalindicators').MACD;

const RedisClient = require('redis');
const BinanceAPI = require("./BinanceAPI");

function AutoBot(tradeCur, baseCur, MACDPeriod, interval) {

    this.BaseCurrency = baseCur;
    this.TradeCurrency = tradeCur;
    this.Symbol = this.TradeCurrency + this.BaseCurrency;

    this.MACDPeriod = MACDPeriod;

    this.IntervalMinute = interval / 60;

    this.API = new BinanceAPI(this.TradeCurrency, this.BaseCurrency);

    this.BUY_SIGNAL = 0.75;
    this.SELL_SIGNAL = 0.75;

    this.BUY_MINPERIOD = 3;
    this.SELL_MINPERIOD = 3;

};

module.exports = AutoBot;

AutoBot.prototype.init = function (root, port, host) {

    this.Bots = root.bots;

    this.caching = RedisClient.createClient(port, host);
    // this.caching.flushall();
    this.caching.on("error", function (err) {
        console.log(err);
        console.error(err.stack);
    });

};

AutoBot.prototype.start = function () {

    console.log("Start : " + this.TradeCurrency + "-" + this.BaseCurrency + " with MACD = " + this.MACDPeriod);

    console.log("----------------------------------------------------------------------");

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

            let data = [{

                Time: "[" + moment().utcOffset(7).format("YYYY-MM-DD HH:mm") + "]",
                Type: "BUY",
                Qty: suggest.amount,
                Coin: this.TradeCurrency,
                Price: suggest.price,
                Ex: this.BaseCurrency + "/" + this.TradeCurrency

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
            console.log("----------------------------------------------------------------------");


        }
    }

    if (await this.shouldToSELL()) {

        let suggest = await this.suggestSellPrice();
        if (suggest) {

            let newOrder = await this.API.sell(suggest.amount, suggest.price);

            let data = [{

                Time: "[" + moment().utcOffset(7).format("YYYY-MM-DD HH:mm") + "]",
                Type: "SELL",
                Qty: suggest.amount,
                Coin: this.TradeCurrency,
                Price: suggest.price,
                Ex: this.BaseCurrency + "/" + this.TradeCurrency

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
            console.log("----------------------------------------------------------------------");

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
        let minNotional = await that.API.getMinNotionalAmount();
        if (baseBal < minNotional) {
            resolve(false);
            return;
        }

        let wannaTrade = await that.API.convertTo(baseBal, that.BaseCurrency, that.TradeCurrency);
        let minTrade = await that.API.getMinTradeAmount();
        if (wannaTrade < minTrade) {
            resolve(false);
            return;
        }

        let percent = await that.caclBUYPercent(that.BUY_MINPERIOD);

        var should = percent > that.BUY_SIGNAL;
        if (should) {

            console.log(that.Symbol + " : percent = " + percent);
            console.log(that.Symbol + " : maxPercent = " + that.BUY_SIGNAL);
        }

        resolve(should);
    });
};

AutoBot.prototype.caclBUYPercent = async function (minPeriod) {

    var that = this;
    return new Promise(async function (resolve) {

        var histories = await that.API.chartHistory(that.MACDPeriod);
        //var histories = await that.API.chartHistoryInBase(that.MACDPeriod, "USDT");

        var macd = await that.MACD(histories);
        if (!macd || macd.length < 10) {
            resolve(0);
            return;
        }

        var currentIndex = macd.length - 2;
        var current = macd[currentIndex];

        var leftMin = current;
        var leftMinIndex = currentIndex;

        for (var i = currentIndex - 1; i >= 0; i--) {
            if (macd[i].histogram < leftMin.histogram) {
                leftMin = macd[i];
                leftMinIndex = i;
            } else {
                break;
            }
        }

        if (Math.abs(currentIndex - leftMinIndex) < minPeriod) {
            resolve(0);
            return;
        }
        var diff = current.histogram - leftMin.histogram;
        let percent = diff / Math.abs(leftMin.histogram);

        resolve(percent);
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

        let percent = await that.caclSElLPercent(that.SELL_MINPERIOD);
        var should = percent > that.SELL_SIGNAL;

        if (!should && percent > 0.7 * that.SELL_SIGNAL) {
            should = await that.shouldToSELL_CheckOtherBots();
            if (should) {
                console.log("Should SELL " + that.TradeCurrency + " by another required");
            }
        }

        if (should) {
            console.log(that.Symbol + " : percent = " + percent);
            console.log(that.Symbol + " : maxPercent = " + that.SELL_SIGNAL);
        }

        resolve(should);
    });
};

AutoBot.prototype.shouldToSELL_CheckOtherBots = async function () {

    var that = this;
    return new Promise(async function (resolve) {

        for (var i = 0; i < that.Bots.length; i++) {

            let other = that.Bots[i];
            if (other != that &&
                other.BaseCurrency == that.BaseCurrency
                && other.TradeCurrency != that.TradeCurrency) {

                let percent = await other.caclBUYPercent(that.BUY_MINPERIOD + 2);
                if (percent > (that.BUY_SIGNAL + 1.25)) {
                    resolve(true);
                    return;
                }

            }
            if (i == that.Bots.length - 1) {
                resolve(false);
                return;
            }
        }
    });
};


AutoBot.prototype.caclSElLPercent = async function (minPeriod) {

    var that = this;
    return new Promise(async function (resolve) {

        var histories = await that.API.chartHistory(that.MACDPeriod);
        //var histories = await that.API.chartHistoryInBase(that.MACDPeriod, "USDT");

        var macd = await that.MACD(histories);

        if (!macd || macd.length < 10) {
            resolve(0);
            return;
        }

        var currentIndex = macd.length - 2;
        var current = macd[currentIndex];

        var leftMax = current;
        var leftMaxIndex = currentIndex;

        for (var i = currentIndex - 1; i >= 0; i--) {
            if (macd[i].histogram > leftMax.histogram) {
                leftMax = macd[i];
                leftMaxIndex = i;
            } else {
                break;
            }
        }

        if (Math.abs(currentIndex - leftMaxIndex) < minPeriod) {
            resolve(0);
            return;
        }

        var diff = leftMax.histogram - current.histogram;
        let percent = diff / Math.abs(leftMax.histogram);

        resolve(percent);
    });
};

AutoBot.prototype.suggestBuyPrice = async function () {

    let baseBal = await this.API.getBalance(this.BaseCurrency);
    let minNotional = await this.API.getMinNotionalAmount();
    if (baseBal < minNotional)
        return null;

    let wannaTrade = await this.API.convertTo(baseBal, this.BaseCurrency, this.TradeCurrency);
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

    for (var i = 1; i < sellings.length; i++) {

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

    console.log(this.Symbol + " : tradableAmt1 = " + tradableAmt);
    if (tradableAmt > wannaTrade)
        tradableAmt = wannaTrade;

    console.log(this.Symbol + " : tradableAmt2 = " + tradableAmt);
    if (tradableAmt < minTrade)
        return null;

    let result = await this.API.correctTradeOrder(tradableAmt, lowestPrice);

    console.log(this.Symbol + " : correctTradeOrder = " + result);

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

    for (var i = 1; i < buyings.length; i++) {

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
