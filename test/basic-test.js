var expect = require('expect.js');
var Proxy = require('../index');
var http = require('http');
var request_factory = require('./request');

var host = '127.0.0.1';
var port = 8081;
var dummyport = 8082;

var doRequest = request_factory(host, port, dummyport);
describe('basic proxying', function() {
    var proxy;
    var dummyserver;
    var requestHeaders;
    var requestData;
    var respondStatusCode;
    var respondData;
    var respondHeaders;
    before(function(done) {
        var todo = 2;
        proxy = new Proxy();
        proxy.listen(port, host, function() {
            if (--todo == 0) done();
        });

        requestData = '';
        requestHeaders = {};

        respondStatusCode = 200;
        respondData = '';
        respondHeaders = {};

        dummyserver = http.createServer(function(request, response) {
            requestHeaders = request.headers;
            request.on('data', function(chunk) {
                requestData += chunk;
            });
            response.writeHead(respondStatusCode, respondHeaders);
            response.write(respondData);
            response.end();
        }).listen(dummyport, host, function() {
            if (--todo == 0) done();
        });
    });

    after(function(done) {
        var todo = 2;
        dummyserver.close(function() {
            if (--todo == 0) done();
        });
        proxy.close(function() {
            if (--todo == 0) done();
        });
    });

    it('should proxy a request', function(done) {
        doRequest(function(err, res) {
            expect(res.statusCode).to.be(200);
            done();
        });
    });

    it('should proxy request data', function(done) {
        var data = 'asd';
        doRequest({data: data, method: 'POST'}, function(err, res) {
            expect(requestData).to.be(data);
            done();
        });
    });

    it('should proxy request headers', function(done) {
        var data = 'asd';
        doRequest({headers: {'x-test': data}}, function(err, res) {
            expect(requestHeaders['x-test']).to.be(data);
            done();
        });
    });

    it('should get the response data', function(done) {
        respondData = 'HELLO WORLD';
        doRequest(function(err, res) {
            expect(res.data).to.be(respondData);
            done();
        });
    });

    it('should get the response headers', function(done) {
        respondHeaders = {'x-test': 'HELLO WORLD'};
        doRequest(function(err, res) {
            expect(res.headers['x-test']).to.be(respondHeaders['x-test']);
            done();
        });
    });
});
