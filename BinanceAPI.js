
function BinanceAPI(baseCur, tradeCur) {

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

BinanceAPI.prototype.getTotalBalanceInBase = async function (baseCur) {

    return new Promise((resolve) => {

        var _this = this;

        this.binance.balance(async function (balances) {

            var total = 0;
            for (var currency in balances) {

                if (balances[currency] && balances[currency].available > 0) {

                    let balInBase = (await _this.convertTo(balances[currency].available, currency, baseCur));

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
                resolve((1 / rate) * amount);
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

            try {
                var filters = symbols[0].filters.filter(filter => filter.filterType == 'LOT_SIZE');
                if (filters.length <= 0) {
                    resolve(-1);
                    return;
                }

                var minQty = filters[0].minQty;
                minQty = parseFloat(minQty);

                resolve(minQty);

            } catch (error) {

                resolve(-1);
            }

        });

    }).catch(error => {

        console.log("error = " + error);
    });
};

BinanceAPI.prototype.roundByStepLimit = async function (value) {

    let minAmt = await this.getMinTradeAmount();
    let precision = await this.getTradePrecision();

    var round = (value / minAmt).toFixed() * minAmt;
    return round.toFixed(precision);
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
