var PassThrough = (require('stream').PassThrough ||
      require('readable-stream').PassThrough);
var EventEmitter = require('events').EventEmitter;
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
        this.client.set(this.key('method'), request.method);
        this.client.set(this.key('url'), request.url);
        if (request.headers) {
            this.client.hmset(this.key('headers'), request.headers);
        }
    } else {
        this.client.set(this.key('status'), response_data.statusCode);
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
        if (type === 'response') {
            self.client.publish('request:end', requestId);
        }
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
    this.client.append(this.key('data'), chunk.toString('binary'));
    PassThrough.prototype._write.apply(this, arguments);
};

var get_request_queries = function(requestId) {
    return [
        ['get', 'request:' + requestId + ':request:url'],
        ['get', 'request:' + requestId + ':request:method'],
        ['get', 'request:' + requestId + ':request:start'],
        ['get', 'request:' + requestId + ':request:end'],
        ['get', 'request:' + requestId + ':response:status'],
        ['get', 'request:' + requestId + ':response:start'],
        ['get', 'request:' + requestId + ':response:end']
    ];
};

var get_request_object = function(requestId, data) {
    return {
        id: requestId,
        url: data[0],
        method: data[1],
        request_start: data[2],
        request_end: data[3],
        status: data[4],
        response_start: data[5],
        response_end: data[6]
    };
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
    var self = this;
    EventEmitter.call(this);
    var add_request = function(requestId) {
        self.client.multi(get_request_queries(requestId)).exec(
                function(err, replies) {
            self.emit('request:end', get_request_object(requestId, replies));
        });
    };

    var subscriber = redis.createClient(
            options.redis && options.redis.port,
            options.redis && options.redis.host,
            options.redis);
    subscriber.subscribe('request:end');
    subscriber.on('message', function(channel, message) {
        if (channel === 'request:end') {
            add_request(message);
        }
    });
};
util.inherits(RecordProxyFactory, EventEmitter);

/**
 * Proxy generator
 * @param {string} requestId Unique identifier of the request.
 * @param {http.ClientRequest} request The request object.
 * @param {http.ClientResponse} response The response object.
 * @return {RecordProxy} The pipeable object.
 */
RecordProxyFactory.prototype.request = function(requestId, request, response) {
    return new RecordProxy('request', this.client, requestId,
            request, response, this.options);
};

/**
 * Proxy generator
 * @param {string} requestId Unique identifier of the request.
 * @param {http.ClientRequest} request The request object.
 * @param {http.ClientResponse} response The response object.
 * @param {object} response_data Headers & status code.
 * @return {RecordProxy} The pipeable object.
 */
RecordProxyFactory.prototype.response = function(requestId, request, response,
        response_data) {
    return new RecordProxy('response', this.client, requestId,
            request, response, this.options, response_data);
};

/**
 * Lists all existing requests
 * @param {function} callback Function to call with the request array.
 */
RecordProxyFactory.prototype.list_requests = function(callback) {
    var client = this.client;
    client.zrange('requests:request:start', 0, -1, function(err, data) {
        if (err) {
            callback(err);
            return;
        }
        var queries = [];
        data.forEach(function(requestId) {
            queries = queries.concat(get_request_queries(requestId));
        });
        client.multi(queries).exec(function(err, replies) {
            if (err) {
                callback(err);
                return;
            }
            var retval = [];
            for (var i = 0; i < data.length; i++) {
                retval.push(get_request_object(data[i],
                        replies.slice(i * 7, (i + 1) * 7)));
            }
            callback(null, retval);
        });
    });
};

/**
 * Get details of a request
 * @param {string} requestId Request identifier.
 * @param {function} callback Function to call with the request info.
 */
RecordProxyFactory.prototype.get_request = function(requestId, callback) {
    this.client.multi([
        ['get', 'request:' + requestId + ':request:data'],
        ['get', 'request:' + requestId + ':response:data'],
        ['hgetall', 'request:' + requestId + ':request:headers'],
        ['hgetall', 'request:' + requestId + ':response:headers']
    ]).exec(function(err, replies) {
        if (err) {
            callback(err);
            return;
        }
        callback(null, {
            id: requestId,
            request_data: replies[0],
            response_data: replies[1],
            request_headers: replies[2],
            response_headers: replies[3]
        });
    });
};
