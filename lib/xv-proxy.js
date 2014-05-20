var http = require('http');
var url = require('url');

/**
 * @constructor
 */
var Proxy = function() {
    var self = this;
    this.server = http.createServer(function(request, response) {
        var options = url.parse(request.url);
        options.port = options.port || 80;
        options.method = request.method;
        options.headers = request.headers;
        var proxy_request = http.request(options, function(proxy_response) {
            var r = proxy_response;
            self.responsePipeFactories.forEach(function(obj) {
                r = r.pipe(obj.callback(request, response));
            });
            r.pipe(response);
            response.writeHead(proxy_response.statusCode,
                 proxy_response.headers);
        });
        var r = request;
        self.requestPipeFactories.forEach(function(obj) {
            r = r.pipe(obj.callback(request, response));
        });
        r.pipe(proxy_request);
    });
    this.requestPipeFactories = [];
    this.responsePipeFactories = [];
};

/**
 * @param {callback} callback A function that returns a pipeable object to use
 * on each request.
 * @param {int} priority How early on the pipe factory it should be.
 */
Proxy.prototype.addRequestPipeFactory = function(callback, priority) {
    var index = this.requestPipeFactories.length;
    this.requestPipeFactories.forEach(function(v, i) {
        if (v.priority < priority) {
            index = i;
            return false;
        }
    });
    this.requestPipeFactories.splice(index, 0, {
        callback: callback,
        priority: priority
    });
};

/**
 * @param {callback} callback A function that returns a pipeable object to stop
 * using on each request.
 */
Proxy.prototype.removeRequestPipeFactory = function(callback) {
    var index = 1;
    while (index != -1) {
        index = -1;
        this.requestPipeFactories.forEach(function(v, i) {
            if (v.callback < callback) {
                index = i;
                return false;
            }
        });
    }
};

/**
 */
Proxy.prototype.removeAllRequestPipeFactory = function() {
    this.requestPipeFactories = [];
};

/**
 * @param {callback} callback A function that returns a pipeable object to use
 * on each response.
 * @param {int} priority How early on the pipe factory it should be.
 */
Proxy.prototype.addResponsePipeFactory = function(callback, priority) {
    var index = this.responsePipeFactories.length;
    this.responsePipeFactories.forEach(function(v, i) {
        if (v.priority < priority) {
            index = i;
            return false;
        }
    });
    this.responsePipeFactories.splice(index, 0, {
        callback: callback,
        priority: priority || 0
    });
};

/**
 * @param {callback} callback A function that returns a pipeable object to stop
 * using on each response.
 */
Proxy.prototype.removeResponsePipeFactory = function(callback) {
    var index = 1;
    while (index != -1) {
        index = -1;
        this.responsePipeFactories.forEach(function(v, i) {
            if (v.callback < callback) {
                index = i;
                return false;
            }
        });
    }
};

/**
 */
Proxy.prototype.removeAllResponsePipeFactory = function() {
    this.responsePipeFactories = [];
};

/**
 * Listen to a port from a host and calls a callback
 * @param {number} port The port to listen to.
 * @param {string} host The acceptables hosts. Use 0.0.0.0 for every host.
 * @param {function} callback Function to call once the proxy is listening.
 */
Proxy.prototype.listen = function(port, host, callback) {
    this.server.listen.apply(this.server,
            Array.prototype.slice.call(arguments));
};

/**
 * Close the proxy server
 * @param {function} callback Function to call once the proxy is stopped.
 */
Proxy.prototype.close = function(callback) {
    this.server.close.apply(this.server,
            Array.prototype.slice.call(arguments));
};

/**
 * Proxy server
 */
module.exports = Proxy;
