var expect = require('expect.js');
var Proxy = require('../index');
var http = require('http');
var request_factory = require('./request');
var util = require('util');
var PassThrough = (require('stream').PassThrough ||
      require('readable-stream').PassThrough);
var MemoryRecorder = require('../lib/recorder/memory');

var host = '127.0.0.1';
var port = 8081;
var dummyport = 8082;

var doRequest = request_factory(host, port, dummyport);
describe('pipe proxying', function() {
    var proxy;
    var recorder;
    var RecordProxy;

    before(function(done) {
        var todo = 2;
        proxy = new Proxy();
        proxy.listen(port, host, function() {
            if (--todo == 0) done();
        });

        var i = 0;
        dummyserver = http.createServer(function(request, response) {
            response.writeHead(200, {'x-test': 'yes' + (++i)});
            response.write('hello world ' + i);
            response.end();
        }).listen(dummyport, host, function() {
            if (--todo == 0) done();
        });

        recorder = new MemoryRecorder();
        proxy.addRequestPipeFactory(recorder.request.bind(recorder));
        proxy.addResponsePipeFactory(recorder.response.bind(recorder));
    });

    afterEach(function() {
        proxy.removeAllRequestPipeFactory();
        proxy.removeAllResponsePipeFactory();
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

    it('should be able to read request data', function(done) {
        var start = Date.now();
        var todo = 2;
        recorder.on('request:end', function(r) {
            var now = Date.now();
            expect(r.request_start).to.be.within(start, now);
            expect(r.request_end).to.be.within(start, now);
            expect(r.response_start).to.be.above(r.request_end);
            expect(r.response_start).to.be.within(start, now);
            expect(r.response_end).to.be.within(start, now);
            expect([
                'http://127.0.0.1:8082/url1',
                'http://127.0.0.1:8082/url2']).to.contain(
                r.url);


            expect(['asd', 'qwe']).to.contain(r.request_data);

            expect(r.request_headers.host).to.be('127.0.0.1:8081');

            expect(r.status).to.be('200');

            expect([
                'hello world 1',
                'hello world 2']).to.contain(r.response_data);

            expect(['yes1', 'yes2']).to.contain(
                    r.response_headers['x-test']);

            if (--todo === 0) {
                done();
            }
        });
        doRequest({url: 'url1', data: 'asd', method: 'POST'});
        doRequest({url: 'url2', data: 'qwe', method: 'POST'});
    });
});

