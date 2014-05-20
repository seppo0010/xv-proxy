var expect = require('expect.js');
var Proxy = require('../index');
var http = require('http');
var request_factory = require('./request');
var util = require('util');
var Transform = (require('stream').Transform ||
      require('readable-stream').Transform);

var host = '127.0.0.1';
var port = 8081;
var reverseport = 8082;

var doRequest = request_factory(host, port, reverseport);
describe('pipe transforming', function() {
    var proxy;
    var reverseserver;
    var factoryfactory;
    var reverse = function(chunk, encoding) {
        if (Buffer.isBuffer(chunk)) {
            for (var i = 0; i < chunk.length / 2; i++) {
                var l = chunk[i], k = chunk[chunk.length - i - 1];
                chunk[i] = k;
                chunk[chunk.length - i - 1] = l;
            }
            return chunk;
        } else {
            return chunk.split('').reverse().join('');
        }
    };

    before(function(done) {
        var todo = 2;
        proxy = new Proxy();
        proxy.listen(port, host, function() {
            if (--todo == 0) done();
        });

        reverseserver = http.createServer(function(request, response) {
            response.writeHead(200);

            var ReverseProxy = function() {
                Transform.apply(this, arguments);
            };
            util.inherits(ReverseProxy, Transform);

            ReverseProxy.prototype._transform = function(
                    chunk, encoding, done) {
                this.push(reverse(chunk, encoding));
                done();
            };

            request.pipe(new ReverseProxy()).pipe(response);
        }).listen(reverseport, host, function() {
            if (--todo == 0) done();
        });

        var echo = function(data) { return data; };

        var TransformProxy = function(options) {
            this.options = options;
            Transform.call(this, options);
        };
        util.inherits(TransformProxy, Transform);

        TransformProxy.prototype._transform = function(chunk, encoding, done) {
            this.push(this.options.callback(chunk));
            done();
        };

        factoryfactory = function(callback) {
            return function(req, res) {
                return new TransformProxy({callback: callback || echo});
            };
        };
    });

    afterEach(function() {
        proxy.removeAllRequestPipeFactory();
        proxy.removeAllResponsePipeFactory();
    });

    after(function(done) {
        var todo = 2;
        reverseserver.close(function() {
            if (--todo == 0) done();
        });
        proxy.close(function() {
            if (--todo == 0) done();
        });
    });

    it('should be able to change the request data', function(done) {
        var data = 'asd';
        var fakeData = 'qwe';
        proxy.addRequestPipeFactory(factoryfactory(function(data) {
            return fakeData;
        }));
        doRequest({data: data, method: 'POST'}, function(err, res) {
            expect(res.data).to.be(reverse(fakeData));
            done();
        });
    });

    it('should be able to change the response data', function(done) {
        var data = 'asd';
        var fakeData = 'qwe';
        proxy.addResponsePipeFactory(factoryfactory(function(data) {
            return fakeData;
        }));
        doRequest({data: data, method: 'POST'}, function(err, res) {
            expect(res.data).to.be(fakeData);
            done();
        });
    });

    it('should support multiple transform, sort by priority I', function(done) {
        var data = 'asd';
        var fakeData = 'qwe';
        proxy.addResponsePipeFactory(factoryfactory(function(data) {
            return fakeData;
        }), 100);
        proxy.addResponsePipeFactory(factoryfactory(function(data) {
            return reverse(data);
        }), 0);
        doRequest({data: data, method: 'POST'}, function(err, res) {
            expect(res.data).to.be(reverse(fakeData));
            done();
        });
    });

    it('should support multiple transform, sort by priority II',
            function(done) {
        var data = 'asd';
        var fakeData = 'qwe';
        proxy.addResponsePipeFactory(factoryfactory(function(data) {
            return fakeData;
        }), 0);
        proxy.addResponsePipeFactory(factoryfactory(function(data) {
            return reverse(data);
        }), 100);
        doRequest({data: data, method: 'POST'}, function(err, res) {
            expect(res.data).to.be(fakeData);
            done();
        });
    });
});
