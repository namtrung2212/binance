
var fs = require('fs');
var http = require('http');
var express = require('express');
var bodyParser = require('body-parser');
const RedisClient = require('redis');

const BinanceAPI = require("./BinanceAPI");

var API = new BinanceAPI("XRP", "BTC");


var caching = RedisClient.createClient("6379", "localhost");
caching.flushall();

const app = express();
app.get('/balance', function (req, res) {

    API.getBalances("USDT").then(function (balance) {

        res.json(balance);

    });

});

app.listen(57575, function () {
})
