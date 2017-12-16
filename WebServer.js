
var http = require('http');
var express = require('express');
var bodyParser = require('body-parser');

const BinanceAPI = require("./BinanceAPI");
var API = new BinanceAPI("XRP", "BTC");

const RedisClient = require('redis');
var caching = RedisClient.createClient("6379", "localhost");
caching.flushall();

const WebServer = express();
WebServer.use(bodyParser.urlencoded({ extended: false }))
WebServer.use(bodyParser.json());
WebServer.set('view engine', 'ejs');
WebServer.get('/balance', function (req, res) {

    var currency = "USDT";
    if (req.query.currency)
        currency = req.query.currency;

    API.getBalances(currency).then(function (balance) {

        res.render('balance', balance);

    });

});

var httpServer = http.createServer(WebServer);
httpServer.listen(8080);