
const RedisServer = require('redis-server');
var port = "57589";

new RedisServer(port).open((err) => {

    if (err === null) {

        const AutoBot = require("./AutoBot");

        var bot1 = new AutoBot("USDT", "BTC", 0.5, "5m", 0.5);
        bot1.initRedis(port);
        bot1.start();

    } else {

        console.log(err);
    }
});
