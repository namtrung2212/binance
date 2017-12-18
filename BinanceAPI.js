
function BinanceAPI(tradeCur, baseCur) {

    this.BaseCurrency = baseCur;
    this.TradeCurrency = tradeCur;
    this.Symbol = this.TradeCurrency + this.BaseCurrency;

    this.binance = require('node-binance-api');
    this.binance.options({
        'APIKEY': 'OZzGDGjKaqw3bxEfTUIlE725S7erTr3rk4L527k3x66zrC8MVNSGjKiuIvU672SU',
        'APISECRET': 'bpNq44Ks5YmUEIYdo5M8yFH8PdIKd9HVaoSiDGGDXXUEdIVMinrZZ72YHeAMbWAY'
    });

};

module.exports = BinanceAPI;

BinanceAPI.prototype.getBalance = async function (currency) {

    return new Promise((resolve) => {
        this.binance.balance(function (balances) {
            resolve(balances[currency].available);
        });

    });
};

BinanceAPI.prototype.getBalances = async function (baseCur) {

    return new Promise((resolve) => {

        var _this = this;

        this.binance.balance(async function (balances) {

            var list = [];

            var total = 0;
            var count = 0;

            for (var currency in balances) {

                if (balances[currency] && balances[currency].available > 0) {

                    let balInBase = (await _this.convertTo(balances[currency].available, currency, "BTC"));
                    balInBase = (await _this.convertTo(balInBase, "BTC", baseCur));

                    if (balInBase) {
                        total += parseFloat(balInBase);

                        var obj = {};
                        obj.Currency = currency;
                        obj.Available = balances[currency].available;
                        obj.Base = parseFloat(balInBase).toFixed(8);

                        list.push(obj);
                    }
                }
                count++;

                if (count == Object.keys(balances).length) {
                    resolve({
                        Total: parseFloat(total).toFixed(8),
                        Base: baseCur,
                        Trades: list
                    });
                    return;
                }

            }

        });

    }).catch(error => {

        console.log("error = " + error);
    });
};

BinanceAPI.prototype.getTotalBalanceInBase = async function (baseCur) {

    return new Promise((resolve) => {

        var _this = this;

        this.binance.balance(async function (balances) {

            var total = 0;
            for (var currency in balances) {

                if (balances[currency] && balances[currency].available > 0) {

                    let balInBase = (await _this.convertTo(balances[currency].available, currency, baseCur));
                    if (balInBase)
                        total += parseFloat(balInBase);
                }
            }

            resolve(parseFloat(total).toFixed(8));
        });

    });
};

BinanceAPI.prototype.getCurrentPrice = async function () {

    return new Promise((resolve) => {
        var _this = this;
        this.binance.prices(function (ticker) {
            resolve(ticker[_this.Symbol]);
        });
    });
};

BinanceAPI.prototype.convertTo = async function (amount, fromCurrency, toCurrency) {

    return new Promise((resolve) => {

        var _this = this;

        if (fromCurrency == toCurrency) {
            resolve(amount);
            return;
        }

        this.binance.prices(function (ticker) {

            var rate = ticker[fromCurrency + toCurrency];
            if (rate) {

                resolve(rate * amount);

            } else {
                rate = ticker[toCurrency + fromCurrency];
                if (rate > 0)
                    resolve((1 / rate) * amount);
                else
                    resolve(null);
            }

        });
    });
};

BinanceAPI.prototype.getMinTradeAmount = async function () {

    return new Promise((resolve) => {

        var _this = this;
        this.binance.exchangeInfo(function (info) {

            var symbols = info.symbols.filter(symbol => symbol.symbol == _this.Symbol);
            if (symbols.length <= 0) {
                resolve(-1);
                return;
            }

            let symbol = symbols[0];

            try {

                var lotSizes = symbol.filters.filter(x => x.filterType == 'LOT_SIZE');
                if (lotSizes.length <= 0) {
                    resolve(-1);
                    return;
                }

                let minQty = parseFloat(lotSizes[0].minQty);
                resolve(minQty);

            } catch (error) {

                resolve(-1);
            }

        });

    }).catch(error => {

        console.log("error = " + error);
    });
};

BinanceAPI.prototype.correctTradeOrder = async function (value, price) {

    return new Promise((resolve) => {

        var _this = this;
        this.binance.exchangeInfo(function (info) {

            var symbols = info.symbols.filter(symbol => symbol.symbol == _this.Symbol);
            if (symbols.length <= 0) {
                resolve(null);
                return;
            }

            let symbol = symbols[0];
            let precision = symbol.baseAssetPrecision;

            try {

                var lotSizes = symbol.filters.filter(x => x.filterType == 'LOT_SIZE');
                var minNotionals = symbol.filters.filter(x => x.filterType == 'MIN_NOTIONAL');
                if (lotSizes.length <= 0 || minNotionals.length <= 0) {
                    resolve(null);
                    return;
                }

                let minQty = parseFloat(lotSizes[0].minQty);
                let maxQty = parseFloat(lotSizes[0].maxQty);
                let stepSize = parseFloat(lotSizes[0].stepSize);
                var minNotional = parseFloat(minNotionals[0].minNotional);

                var qty = parseFloat(parseInt(value / stepSize) * stepSize);
                qty = qty.toFixed(precision);

                if (qty < minQty || qty > maxQty) {
                    resolve(null);
                    return;
                }

                if ((price * qty) < minNotional) {
                    resolve(null);
                    return;
                }

                resolve({
                    price: price.toFixed(precision),
                    amount: qty
                });

            } catch (error) {

                console.log("error = " + error);
                resolve(null);
            }

        });

    }).catch(error => {

        console.log("error = " + error);
    });

};

BinanceAPI.prototype.getTradePrecision = async function () {

    return new Promise((resolve) => {

        var _this = this;
        this.binance.exchangeInfo(function (info) {

            var symbols = info.symbols.filter(symbol => symbol.baseAsset == _this.TradeCurrency);
            if (symbols.length > 0) {
                resolve(symbols[0].baseAssetPrecision);
                return;
            }

            symbols = info.symbols.filter(symbol => symbol.quoteAsset == _this.TradeCurrency);
            if (symbols.length > 0) {
                resolve(symbols[0].quotePrecision);
                return;
            }

            resolve(8);

        });

    }).catch(error => {

        console.log("error = " + error);
    });
};

BinanceAPI.prototype.DepthSelling = async function () {

    return new Promise((resolve) => {
        this.binance.depth(this.Symbol, function (depth) {

            var asks = JSON.stringify(depth.asks).split(",").map(function (val) {
                return {
                    price: parseFloat(val.split(":")[0].replace("\"", "")),
                    amount: parseFloat(val.split(":")[1]),
                };
            });

            resolve(asks);
        });
    });
};

BinanceAPI.prototype.DepthBuying = async function () {

    return new Promise((resolve) => {
        this.binance.depth(this.Symbol, function (depth) {

            var bids = JSON.stringify(depth.bids).split(",").map(function (val) {
                return {
                    price: parseFloat(val.split(":")[0].replace("\"", "")),
                    amount: parseFloat(val.split(":")[1]),
                };
            });

            resolve(bids);
        });
    });
};

BinanceAPI.prototype.trades = async function () {

    return new Promise((resolve) => {
        this.binance.trades(this.Symbol, function (trades, symbol) {
            resolve(trades);
        });
    });
};

BinanceAPI.prototype.getOpeningOrders = async function () {

    return new Promise((resolve) => {
        this.binance.openOrders(this.Symbol, function (json) {
            resolve(json);
        });
    });
};

BinanceAPI.prototype.checkStatus = async function (orderid) {

    return new Promise((resolve) => {
        this.binance.orderStatus(this.Symbol, orderid, function (orderStatus, symbol) {
            resolve(orderStatus);
        });
    });
};

BinanceAPI.prototype.cancelOrder = async function (orderid) {

    return new Promise((resolve) => {
        this.binance.cancel(this.Symbol, orderid, function (response) {
            resolve(response);
        });
    });
};

BinanceAPI.prototype.buy = async function (amount, price) {

    return new Promise((resolve) => {
        this.binance.buy(this.Symbol, amount, price, {}, function (response) {
            resolve(response);
        });
    });
};

BinanceAPI.prototype.sell = async function (amount, price) {

    return new Promise((resolve) => {
        this.binance.sell(this.Symbol, amount, price, {}, function (response) {
            resolve(response);
        });
    });
};

BinanceAPI.prototype.chartHistory = async function (interval) {

    return new Promise((resolve) => {
        this.binance.candlesticks(this.Symbol, interval, function (ticks) {
            let closedArr = Array.from(ticks, x => parseFloat(x[4]));
            let timeArr = Array.from(ticks, x => parseFloat(x[0]));
            resolve({ prices: closedArr, times: timeArr });
        });
    });
};


BinanceAPI.prototype.chartHistoryBySymbol = async function (interval, tradeCur, baseCur) {

    return new Promise((resolve) => {

        let symbol = tradeCur + baseCur;

        this.binance.candlesticks(symbol, interval, function (ticks) {
            let closedArr = Array.from(ticks, x => parseFloat(x[4]));
            let timeArr = Array.from(ticks, x => parseFloat(x[0]));
            resolve({ prices: closedArr, times: timeArr });
        });
    });
};



BinanceAPI.prototype.chartHistoryInBase = async function (interval, masterBaseCur) {

    var that = this;
    return new Promise(async function (resolve) {

        let his1 = await that.chartHistoryBySymbol(interval, that.TradeCurrency, that.BaseCurrency);
        if (masterBaseCur == that.BaseCurrency) {
            resolve(his1);
            return;
        }

        let his2 = await that.chartHistoryBySymbol(interval, that.BaseCurrency, that.masterBaseCur);
        let count = Math.min(his1.length, his2.length);

        for (var i = 1; i <= count; i++) {
            his1.prices[his1.length - i] = his1.prices[his1.length - i] * his2.prices[his2.length - i];
            if (i == count)
                resolve(his1);
        }

    });
};
