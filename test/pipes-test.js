var expect = require('expect.js');
var Proxy = require('../index');
var http = require('http');
var request_factory = require('./request');
var util = require('util');
var PassThrough = (require('stream').PassThrough ||
      require('readable-stream').PassThrough);

var host = '127.0.0.1';
var port = 8081;
var echoport = 8082;

var doRequest = request_factory(host, port, echoport);
describe('pipe proxying', function() {
    var proxy;
    var echoserver;
    var recordproxyrequest;
    var recordproxyrequestfactory;
    var recordproxyresponse;
    var recordproxyresponsefactory;
    var RecordProxy;

    before(function(done) {
        var todo = 2;
        proxy = new Proxy();
        proxy.listen(port, host, function() {
            if (--todo == 0) done();
        });

        echoserver = http.createServer(function(request, response) {
            response.writeHead(200);
            request.pipe(response);
        }).listen(echoport, host, function() {
            if (--todo == 0) done();
        });

        RecordProxy = function(options) {
            PassThrough.call(this, options);
            this.data = '';
        };
        util.inherits(RecordProxy, PassThrough);

        RecordProxy.prototype._read = function() {
            return PassThrough.prototype._read.apply(this, arguments);
        };
        RecordProxy.prototype._write = function(chunk) {
            this.data += chunk.toString();
            return PassThrough.prototype._write.apply(this, arguments);
        }
        recordproxyrequestfactory = function() {
            return recordproxyrequest = new RecordProxy();
        }
        recordproxyresponsefactory = function() {
            return recordproxyresponse = new RecordProxy();
        }
        proxy.addRequestPipeFactory(recordproxyrequestfactory);
        proxy.addResponsePipeFactory(recordproxyresponsefactory);
    });

    beforeEach(function() {
        recordproxyrequest = recordproxyresponse = null;
    });

    after(function(done) {
        var todo = 2;
        echoserver.close(function() {
            if (--todo == 0) done();
        });
        proxy.close(function() {
            if (--todo == 0) done();
        });
        proxy.removeRequestPipeFactory(recordproxyrequestfactory);
        proxy.removeResponsePipeFactory(recordproxyresponsefactory);
    });

    it('should be able to read request data', function(done) {
        var data = 'asd';
        doRequest({data: data, method: 'POST'}, function(err, res) {
            expect(recordproxyrequest.data).to.be(data);
            expect(res.data).to.be(data);
            done();
        });
    });

    it('should be able to read response data', function(done) {
        var data = 'asd';
        doRequest({data: data, method: 'POST'}, function(err, res) {
            expect(recordproxyresponse.data).to.be(data);
            expect(res.data).to.be(data);
            done();
        });
    });

    it('should sleep 500ms', function(done) {
        var t = Date.now();
        var data = 'asd';
        var slowdownfactory = function() {
            var SlowDown = function(options) {
                PassThrough.call(this, options);
            };
            util.inherits(SlowDown, PassThrough);

            SlowDown.prototype._read = function() {
                return PassThrough.prototype._read.apply(this, arguments);
            };

            SlowDown.prototype._write = function() {
                var self = this;
                var args = arguments;
                setTimeout(function() {
                    return PassThrough.prototype._write.apply(self, args);
                }, 500);
            };
            return new SlowDown();
        };
        proxy.addRequestPipeFactory(slowdownfactory);
        doRequest({data: data, method: 'POST'}, function(err, res) {
            expect(recordproxyresponse.data).to.be(data);
            expect(res.data).to.be(data);
            expect(Date.now() - t).to.be.above(500);
            done();
        });
    });
});
