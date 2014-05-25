var expect = require('expect.js');
var Proxy = require('../index');
var http = require('http');
var request_factory = require('./request');
var util = require('util');
var redis;
try {
    redis = require('redis');
} catch (e) {
}
var PassThrough = (require('stream').PassThrough ||
      require('readable-stream').PassThrough);
var RedisRecorder = require('../lib/recorder/redis');

var host = '127.0.0.1';
var port = 8081;
var dummyport = 8082;

var doRequest = request_factory(host, port, dummyport);
var d = redis ? describe : describe.skip;
d('pipe proxying', function() {
    var proxy;
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

        var recorder = new RedisRecorder();
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
        var ready = function() {
            if (--todo === 0) {
                var client = redis.createClient();
                client.zrange('requests:request:start', '0', '-1',
                        function(err, ids) {
                    client.multi([
                        ['zrange', 'requests:request:start', '0', '-1',
                            'WITHSCORES'],
                        ['zrange', 'requests:request:end', '0', '-1',
                            'WITHSCORES'],
                        ['zrange', 'requests:response:start', '0', '-1',
                            'WITHSCORES'],
                        ['zrange', 'requests:response:end', '0', '-1',
                            'WITHSCORES'],
                        ['get', 'request:' + ids[0] + ':request:url'],
                        ['get', 'request:' + ids[0] + ':request:start'],
                        ['get', 'request:' + ids[0] + ':request:end'],
                        ['get', 'request:' + ids[0] + ':request:data'],
                        ['hgetall', 'request:' + ids[0] +
                            ':request:headers'],
                        ['get', 'request:' + ids[0] + ':response:status'],
                        ['get', 'request:' + ids[0] + ':response:start'],
                        ['get', 'request:' + ids[0] + ':response:end'],
                        ['get', 'request:' + ids[0] + ':response:data'],
                        ['hgetall', 'request:' + ids[0] +
                            ':response:headers'],
                        ['get', 'request:' + ids[1] + ':request:url'],
                        ['get', 'request:' + ids[1] + ':request:start'],
                        ['get', 'request:' + ids[1] + ':request:end'],
                        ['get', 'request:' + ids[1] + ':request:data'],
                        ['hgetall', 'request:' + ids[1] +
                            ':request:headers'],
                        ['get', 'request:' + ids[1] + ':response:status'],
                        ['get', 'request:' + ids[1] + ':response:start'],
                        ['get', 'request:' + ids[1] + ':response:end'],
                        ['get', 'request:' + ids[1] + ':response:data'],
                        ['hgetall', 'request:' + ids[1] +
                            ':response:headers']
                    ]).exec(function(err, replies) {
                        var now = Date.now();
                        [0, 1, 2, 3].forEach(function(k) {
                            expect(replies[k].length).to.be(4);
                            expect(replies[k][1]).to.be.within(start, now);
                            expect(replies[k][3]).to.be.within(start, now);
                        });
                        expect([
                            'http://127.0.0.1:8082/url1',
                            'http://127.0.0.1:8082/url2']).to.contain(
                            replies[4]);
                        expect([
                            'http://127.0.0.1:8082/url1',
                            'http://127.0.0.1:8082/url2']).to.contain(
                            replies[14]);
                        expect(replies[4]).not.to.be(replies[14]);

                        expect(replies[5]).to.be.within(start, now);
                        expect(replies[6]).to.be.within(start, now);
                        expect(replies[5]).not.to.be.above(replies[6]);

                        expect(['asd', 'qwe']).to.contain(replies[7]);
                        expect(['asd', 'qwe']).to.contain(replies[17]);
                        expect(replies[7]).not.to.be(replies[17]);

                        expect(replies[8].host).to.be('127.0.0.1:8081');
                        expect(replies[18].host).to.be('127.0.0.1:8081');

                        expect(replies[9]).to.be('200');
                        expect(replies[19]).to.be('200');

                        expect(replies[10]).to.be.within(start, now);
                        expect(replies[11]).to.be.within(start, now);
                        expect(replies[10]).not.to.be.above(replies[11]);

                        expect([
                            'hello world 1',
                            'hello world 2']).to.contain(replies[12]);
                        expect([
                            'hello world 1',
                            'hello world 2']).to.contain(replies[22]);
                        expect(replies[12]).not.to.be(replies[22]);

                        expect(['yes1', 'yes2']).to.contain(
                                replies[13]['x-test']);
                        expect(['yes1', 'yes2']).to.contain(
                                replies[23]['x-test']);
                        expect(replies[13]['x-test']).not.to.be(
                                replies[23]['x-test']);

                        expect(replies[15]).to.be.within(start, now);
                        expect(replies[16]).to.be.within(start, now);
                        expect(replies[15]).not.to.be.above(replies[16]);

                        expect(replies[20]).to.be.within(start, now);
                        expect(replies[21]).to.be.within(start, now);
                        expect(replies[20]).not.to.be.above(replies[21]);

                        done();
                    });
                });
            }
        };
        doRequest({url: 'url1', data: 'asd', method: 'POST'}, ready);
        doRequest({url: 'url2', data: 'qwe', method: 'POST'}, ready);
    });
});
