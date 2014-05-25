var PassThrough = (require('stream').PassThrough ||
      require('readable-stream').PassThrough);
var redis;
try {
    redis = require('redis');
} catch (e) {
    throw new Error('You must install redis package to use redis recorder');
}

var util = require('util');
var RecordProxy = function(type, client, requestId, request, response,
        options, response_data) {
    var start = Date.now();
    PassThrough.call(this, options);
    this.requestId = requestId;
    this.type = type;
    this.client = client;
    if (type === 'request') {
        this.client.set(this.key('url'), request.url);
        if (request.headers) {
            this.client.hmset(this.key('headers'), request.headers);
        }
    } else {
        this.client.set(this.key('status'), response.statusCode);
        if (response_data.headers) {
            this.client.hmset(this.key('headers'), response_data.headers);
        }
    }
    this.client.set(this.key('start'), start);
    this.client.zadd('requests:' + type + ':start', start, requestId);
    var self = this;
    this.on('end', function() {
        var end = Date.now();
        self.client.set(self.key('end'), end);
        self.client.zadd('requests:' + type + ':end', end, requestId);
    });
};
util.inherits(RecordProxy, PassThrough);

/**
 * @param {string} key The name of the request key.
 * @return {string} The name in redis for the key.
 */
RecordProxy.prototype.key = function(key) {
    return 'request:' + this.requestId + ':' + this.type + ':' + key;
};

/**
 * PassThrough data, and writes it into the redis server
 * @param {Buffer} chunk The data.
 */
RecordProxy.prototype._write = function(chunk) {
    this.client.append(this.key('data'), chunk.toString('utf8'));
    PassThrough.prototype._write.apply(this, arguments);
};

/**
 * Proxy factory
 * @constructor
 * @param {object} options The redis server settings.
 */
var RecordProxyFactory = module.exports = function(options) {
    options = options || {};
    this.options = options;
    this.client = redis.createClient(
            options.redis && options.redis.port,
            options.redis && options.redis.host,
            options.redis);
};

/**
 * Proxy generator
 * @param {number} requestId Unique identifier of the request.
 * @param {http.ClientRequest} request The request object.
 * @param {http.ClientResponse} response The response object.
 * @return {RecordProxy} The pipeable object.
 */
RecordProxyFactory.prototype.request = function(requestId, request, response) {
    return new RecordProxy('request', this.client, requestId, request,
            response, this.options);
};

/**
 * Proxy generator
 * @param {number} requestId Unique identifier of the request.
 * @param {http.ClientRequest} request The request object.
 * @param {http.ClientResponse} response The response object.
 * @param {object} response_data Headers & status code.
 * @return {RecordProxy} The pipeable object.
 */
RecordProxyFactory.prototype.response = function(requestId, request, response,
        response_data) {
    return new RecordProxy('response', this.client, requestId, request,
            response, this.options, response_data);
};
