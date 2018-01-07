
var moment = require('moment');
var format = require('string-format');
var columnify = require('columnify');
var MACD = require('technicalindicators').MACD;
var SMA = require('technicalindicators').SMA;

const RedisClient = require('redis');
const BinanceAPI = require("./BinanceAPI");

function AutoBot(root, current) {

    let config = root.botConfigs[current];

    this.BaseCurrency = config.base;
    this.TradeCurrency = config.trade;
    this.Symbol = this.TradeCurrency + this.BaseCurrency;

    this.MACDPeriod = config.MACD;

    this.IntervalMinute = config.Interval / 60;

    this.API = new BinanceAPI(this.TradeCurrency, this.BaseCurrency);

    this.BUY_SIGNAL = root.config.BUY_SIGNAL;
    this.SELL_SIGNAL = root.config.SELL_SIGNAL;

    this.BUY_MINPERIOD = root.config.BUY_MINPERIOD;
    this.SELL_MINPERIOD = root.config.SELL_MINPERIOD;
    this.SELL_MAXPERIOD = root.config.SELL_MAXPERIOD;

    this.caching = RedisClient.createClient(root.config.redisPort, root.config.redisHost);
    // this.caching.flushall();
    this.caching.on("error", function (err) {
        console.log(err);
        console.error(err.stack);
    });

};

module.exports = AutoBot;


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

AutoBot.prototype.MovingAverage = async function (period, histories) {

    return new Promise((resolve) => {

        let output = SMA.calculate({ period: period, values: histories.prices })

        resolve(output);
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

        var lastTrades = await that.API.trades();
        if (lastTrades == null || lastTrades.length <= 0 || lastTrades[lastTrades.length - 1].isBuyer == true) {
            resolve(0);
            return;
        }

        var sellAt = moment.unix(parseFloat(lastTrades[lastTrades.length - 1].time / 1000));
        var minuteQty = moment.utc().diff(sellAt, 'minutes');
        if (minuteQty < 15) {
            resolve(0);
            return;
        }

        var histories = await that.API.chartHistory(that.MACDPeriod);

        var MA9 = await that.MovingAverage(9, histories);
        if (!MA9 || MA9.length < 10) {
            resolve(0);
            return;
        }
        var MA9_1 = MA9[MA9.length - 1];
        var MA9_2 = MA9[MA9.length - 2];
        var MA9_3 = MA9[MA9.length - 3];
        var MA9_4 = MA9[MA9.length - 4];
        var MA9_5 = MA9[MA9.length - 5];
        if (MA9_4 >= MA9_3 || MA9_3 >= MA9_2 || MA9_2 >= MA9_1) {
            resolve(0);
            return;
        }


        var MA25 = await that.MovingAverage(25, histories);
        if (!MA25 || MA25.length < 10) {
            resolve(0);
            return;
        }
        var MA25_1 = MA25[MA25.length - 1];
        var MA25_2 = MA25[MA25.length - 2];
        var MA25_3 = MA25[MA25.length - 3];

        if (MA9_1 < MA25_1 || MA9_2 < MA25_2) {
            resolve(0);
            return;
        }

        var diff1 = MA9_1 - MA25_1;
        var diff2 = MA9_2 - MA25_2;
        var diff3 = MA9_3 - MA25_3;
        if (diff1 > 0 && diff1 > diff2 && diff2 > diff3) {
            resolve(1);
            return;
        }
        resolve(0);

        // var macd = await that.MACD(histories);
        // if (!macd || macd.length < 10) {
        //     resolve(0);
        //     return;
        // }

        // var currentIndex = macd.length - 2;
        // var current = macd[currentIndex];
        // if (current.histogram <= 0) {
        //     resolve(0);
        //     return;
        // }

        // var leftMin = current;
        // var leftMinIndex = currentIndex;

        // for (var i = currentIndex - 1; i >= 0; i--) {
        //     if (macd[i].histogram > 0 && macd[i].histogram < leftMin.histogram) {
        //         leftMin = macd[i];
        //         leftMinIndex = i;
        //     } else {
        //         break;
        //     }
        // }

        // if ((currentIndex - leftMinIndex + 1) <= minPeriod) {
        //     resolve(0);
        //     return;
        // }
        // var diff = current.histogram - leftMin.histogram;
        // let percent = diff / Math.abs(current.histogram);

        // resolve(percent);
        // resolve(1);
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

        let percent = await that.caclSElLPercent(that.SELL_MINPERIOD, that.SELL_MAXPERIOD);
        var should = percent > that.SELL_SIGNAL;

        // if (!should && percent > 0.7 * that.SELL_SIGNAL) {
        //     should = await that.shouldToSELL_CheckOtherBots();
        //     if (should) {
        //         console.log("Should SELL " + that.TradeCurrency + " by another required");
        //     }
        // }

        // if (should) {
        //     console.log(that.Symbol + " : percent1 = " + percent);
        //     console.log(that.Symbol + " : maxPercent1 = " + that.SELL_SIGNAL);
        // }

        resolve(should);
    });
};

AutoBot.prototype.shouldToSELL_CheckOtherBots = async function () {

    var that = this;
    return new Promise(async function (resolve) {

        for (var i = 0; i < that.root.Bots.length; i++) {

            let other = that.root.Bots[i];
            if (other != that &&
                other.BaseCurrency == that.BaseCurrency
                && other.TradeCurrency != that.TradeCurrency) {

                let percent = await other.caclBUYPercent(other.BUY_MINPERIOD + 2);
                if (percent > (other.BUY_SIGNAL + 1.25)) {
                    resolve(true);
                    return;
                }

            }
            if (i == that.root.Bots.length - 1) {
                resolve(false);
                return;
            }
        }
    });
};

AutoBot.prototype.caclSElLPercent = async function (minPeriod, maxPeriod) {

    var that = this;
    return new Promise(async function (resolve) {

        var lastTrades = await that.API.trades();
        if (lastTrades == null || lastTrades.length <= 0
            || lastTrades[lastTrades.length - 1].isBuyer == false) {
            resolve(0);
            return;
        }

        var sellAt = moment.unix(parseFloat(lastTrades[lastTrades.length - 1].time / 1000));
        var minuteQty = moment.utc().diff(sellAt, 'minutes');
        if (minuteQty < 15) {
            resolve(0);
            return;

        }

        let suggest = await that.suggestSellPrice();
        if (suggest == null || suggest == undefined) {
            resolve(0);
            return;
        }

        var boughtPrice = parseFloat(lastTrades[lastTrades.length - 1].price);
        if (suggest.price < boughtPrice * 0.9) {
            resolve(0);
            return;
        }

        if (suggest.price > boughtPrice * 1.04) {
            console.log("SELL" + that.Symbol + " : REASON 1 (benifit > 4%) : " + suggest.price);
            resolve(1);
            return;
        }

        var histories = await that.API.chartHistory(that.MACDPeriod);

        var MA9 = await that.MovingAverage(9, histories);
        if (!MA9 || MA9.length < 10) {
            resolve(0);
            return;
        }
        var MA9_1 = MA9[MA9.length - 1];
        var MA9_2 = MA9[MA9.length - 2];
        var MA9_3 = MA9[MA9.length - 3];
        var MA9_4 = MA9[MA9.length - 4];
        var MA9_5 = MA9[MA9.length - 5];

        var MA25 = await that.MovingAverage(25, histories);
        if (!MA25 || MA25.length < 10) {
            resolve(0);
            return;
        }
        var MA25_1 = MA25[MA25.length - 1];
        var MA25_2 = MA25[MA25.length - 2];
        var MA25_3 = MA25[MA25.length - 3];

        if (MA9_2 > MA9_1 && MA9_3 > MA9_1) {
            console.log("SELL" + that.Symbol + " : REASON 2 : M11 is going down");
            resolve(1);
            return;
        }

        if (MA9_1 < MA25_1) {
            console.log("SELL" + that.Symbol + " : REASON 3 : M11 is going down under MA25");
            resolve(1);
            return;
        }

        resolve(0);

        // var macd = await that.MACD(histories);
        // if (!macd || macd.length < 10) {
        //     resolve(0);
        //     return;
        // }

        // if (macd[macd.length - 3].histogram > macd[macd.length - 2].histogram
        //     || macd[macd.length - 2].histogram > macd[macd.length - 1].histogram) {
        //     resolve(1);
        //     return;
        // }


        // var currentIndex = macd.length - 2;
        // var current = macd[currentIndex];

        // var leftMax = current;
        // var leftMaxIndex = currentIndex;

        // for (var i = currentIndex - 1; i >= 0; i--) {
        //     if (macd[i].histogram > leftMax.histogram) {
        //         leftMax = macd[i];
        //         leftMaxIndex = i;
        //     } else {
        //         break;
        //     }
        // }

        // // if ((currentIndex - leftMaxIndex + 1) < minPeriod) {
        // //     resolve(0);
        // //     return;
        // // }

        // if ((currentIndex - leftMaxIndex + 1) > maxPeriod) {
        //     resolve(1);
        //     return;
        // }

        // var diff = leftMax.histogram - current.histogram;
        // let percent = diff / Math.abs(leftMax.histogram);

        // resolve(percent);
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
