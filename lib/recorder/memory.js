var PassThrough = (require('stream').PassThrough ||
      require('readable-stream').PassThrough);
var EventEmitter = require('events').EventEmitter;

var util = require('util');

var data = {};
var RecordProxy = function(type, requestId, request, response,
        options, response_data) {
    var start = Date.now();
    PassThrough.call(this, options);
    this.requestId = requestId;
    data[requestId] = data[requestId] || {
        id: requestId,
        request_data: '',
        request_headers: {},
        response_data: '',
        response_headers: {}
    };
    this.type = type;
    if (type === 'request') {
        data[requestId].method = request.method;
        data[requestId].url = request.url;
        if (request.headers) {
            data[requestId].request_headers = request.headers;
        }
    } else {
        data[requestId].status = '' + response_data.statusCode;
        if (response_data.headers) {
            data[requestId].response_headers = response_data.headers;
        }
    }
    data[requestId][type + '_start'] = start;
    var self = this;
    this.on('end', function() {
        var end = Date.now();
        data[requestId][type + '_end'] = end;
        if (type === 'response') {
            self.emit('request:end', data[requestId]);
        }
    });
};
util.inherits(RecordProxy, PassThrough);

/**
 * PassThrough data, and writes it into the redis server
 * @param {Buffer} chunk The data.
 */
RecordProxy.prototype._write = function(chunk) {
    data[this.requestId][this.type + '_data'] = (
            data[this.requestId][this.type + '_data'] +
            chunk.toString('binary'));
    PassThrough.prototype._write.apply(this, arguments);
};

/**
 * Proxy factory
 * @constructor
 * @param {object} options Settings.
 */
var RecordProxyFactory = module.exports = function(options) {
    options = options || {};
    this.options = options;
    var self = this;
    EventEmitter.call(this);
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
    return new RecordProxy('request', requestId, request, response,
            this.options);
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
    var proxy = new RecordProxy('response', requestId, request, response,
            this.options, response_data);
    var self = this;
    proxy.on('request:end', function(r) {
        self.emit('request:end', r);
    });
    return proxy;
};

/**
 * Lists all existing requests
 * @param {function} callback Function to call with the request array.
 */
RecordProxyFactory.prototype.list_requests = function(callback) {
    var retval = [];
    Object.keys(data).forEach(function(r) {
        retval.push(data[r]);
    });
    callback(null, retval);
};

/**
 * Get details of a request
 * @param {string} requestId Request identifier.
 * @param {function} callback Function to call with the request info.
 */
RecordProxyFactory.prototype.get_request = function(requestId, callback) {
    callback(null, data[requestId]);
};
