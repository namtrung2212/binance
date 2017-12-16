
var http = require('http');
var express = require('express');
var bodyParser = require('body-parser');

const BinanceAPI = require("./BinanceAPI");
var API = new BinanceAPI("XRP", "BTC");

const RedisClient = require('redis');
var caching = RedisClient.createClient("6379", "localhost");
caching.flushall();

const RESTServer = express();
RESTServer.listen(57575);
RESTServer.get('/balance', function (req, res) {

    var currency = "USDT";
    if (req.query.currency)
        currency = req.query.currency;

    API.getBalances(currency).then(function (balance) {

        res.json(balance);

    });

});
