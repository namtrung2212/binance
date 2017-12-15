
AutoBot.prototype.getLastBuyOrder = async function () {

    return new Promise((resolve) => {

        var _this = this;
        this.caching.get("lastBuyOrder", async function (err, reply) {

            var order = JSON.parse(reply);

            if (!err && order) {

                order = await _this.checkStatus(order.orderId);
                _this.caching.set("lastBuyOrder", JSON.stringify(order));
                resolve(order);
                return;
            }

            resolve(null);
        });
    });
};

AutoBot.prototype.getLastSellOrder = async function () {

    return new Promise((resolve) => {

        var _this = this;
        this.caching.get("lastSellOrder", async function (err, reply) {

            var order = JSON.parse(reply);
            if (!err && order) {

                order = await _this.checkStatus(order.orderId);
                _this.caching.set("lastSellOrder", JSON.stringify(order));
                resolve(order);
                return;
            }

            resolve(null);
        });
    });
};

AutoBot.prototype.testHandler = async function () {

    // let bal = await this.getBaseBalance();
    // console.log(this.BaseCurrency + " balance: ", bal);

    // let price = await this.getCurrentPrice();
    // console.log(this.TradeCurrency + "/" + this.BaseCurrency + ": ", price);

    // let depth = await this.Depth();
    // console.log(this.TradeCurrency + "/" + this.BaseCurrency + ": ", depth);

    // let orders = await this.getOpeningOrders();
    // console.log(this.TradeCurrency + "/" + this.BaseCurrency + ": ", orders);

    // let order = await this.buy(0.018655, 10979.97);
    // console.log("Buy " + this.TradeCurrency + "/" + this.BaseCurrency + ": ", order);

    // let order = await this.sell(0.003158, 18000.03);
    // console.log("Sell " + this.TradeCurrency + "/" + this.BaseCurrency + ": ", order);

    // var result = await this.cancelOrder("9874077");
    // console.log("Canceling " + this.TradeCurrency + "/" + this.BaseCurrency + ": ", result);

    // var result = await this.checkStatus("9874077");
    // console.log("checkStatus " + this.TradeCurrency + "/" + this.BaseCurrency + ": ", result);

    // var result = await this.trades();
    // console.log("trades " + this.TradeCurrency + "/" + this.BaseCurrency + ": ", result);

    // var result = await this.getLastBuyOrder();
    // console.log("getLastBuyOrder " + this.TradeCurrency + "/" + this.BaseCurrency + ": ", result);

    // result = await this.getLastSellOrder();
    // console.log("getLastSellOrder " + this.TradeCurrency + "/" + this.BaseCurrency + ": ", result);

    // var histories = await this.chartHistory("1h");
    // var macd = await this.MACD(histories);
    // console.log("MACD " + this.TradeCurrency + "/" + this.BaseCurrency + ": ", macdOutputs);

};