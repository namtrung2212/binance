
const AutoBot = require("./AutoBot");

var bot1 = new AutoBot("USDT", "BTC", 0.5, "5m", 0.5);
bot1.initRedis("6379", "localhost");
bot1.start();
