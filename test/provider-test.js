var expect = require('expect.js');
var Proxy = require('../index');
var http = require('http');
var request_factory = require('./request');
var util = require('util');
var Readable = (require('stream').Readable ||
      require('readable-stream').Readable);
var Writable = (require('stream').Writable ||
      require('readable-stream').Writable);

var host = '127.0.0.1';
var port = 8081;
var fakeport = 8082;

var doRequest = request_factory(host, port, fakeport);
describe('provider', function() {
    var proxy;

    before(function(done) {
        proxy = new Proxy();
        proxy.listen(port, host, function() {
            done();
        });

        proxy.addProvider(function(requestId, request, callback) {
            var readable = new Readable();
            var data = ['zxc'];
            readable._read = function() {
                this.push(data.pop() || null);
            };
            callback(200, {}, readable);

            var writable = new Writable();
            writable._write = function(chunk, encoding, callback) {
                callback();
            };
            return writable;
        }, 1);
    });

    after(function(done) {
        proxy.close(function() {
            done();
        });
    });

    afterEach(function() {
        proxy.removeAllProviders();
    });

    it('should be able to use a different provider', function(done) {
        doRequest(function(err, res) {
            expect(res.data).to.be('zxc');
            done();
        });
    });
});
