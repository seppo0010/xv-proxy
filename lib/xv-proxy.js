var http = require('http');
var HttpProvider = require('./providers/http');

/**
 * @constructor
 */
var Proxy = function() {
    this.providers = [{callback: HttpProvider, priority: 0}];

    var self = this;
    this.server = http.createServer(function(request, response) {
        var responsePipeFactories = self.responsePipeFactories.slice(0);
        var callback = function(statusCode, headers, pipe) {
            var r = pipe;
            responsePipeFactories.forEach(function(obj) {
                r = r.pipe(obj.callback(request, response));
            });
            r.pipe(response);
            response.writeHead(statusCode, headers);
        };

        var proxy_request;
        self.providers.forEach(function(p) {
            if (!proxy_request) {
                proxy_request = p.callback(request, callback);
            }
        });

        if (!proxy_request) {
            throw new Error('Unable to get request for ' + request.url);
        }

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
 * @param {string} property The name of the list.
 * @param {callback} callback A function to add to the list.
 * @param {int} priority How early on the list it should be.
 */
Proxy.prototype.addCallback = function(property, callback, priority) {
    var index = this[property].length;
    var inserted = false;
    this[property].forEach(function(v, i) {
        if (!inserted && v.priority < priority) {
            index = i;
        }
    });
    this[property].splice(index, 0, {
        callback: callback,
        priority: priority
    });
};

/**
 * @param {string} property The name of the list.
 * @param {callback} callback A function to remove.
 */
Proxy.prototype.removeCallback = function(property, callback) {
    var index = 1;
    while (index != -1) {
        index = -1;
        this[property].forEach(function(v, i) {
            if (v.callback === callback) {
                index = i;
            }
        });
    }
};

/**
 * @param {callback} callback A function that returns a pipeable object to use
 * on each request.
 * @param {int} priority How early on the pipe factory it should be.
 */
Proxy.prototype.addProvider = function(callback, priority) {
    this.addCallback('providers', callback, priority);
};

/**
 * @param {callback} callback A function that returns a pipeable object to stop
 * using on each request.
 */
Proxy.prototype.removeProvider = function(callback) {
    this.removeCallback('providers', callback);
};

/**
 */
Proxy.prototype.removeAllProviders = function() {
    this.providers = [{callback: HttpProvider, priority: 0}];
};

/**
 * @param {callback} callback A function that returns a pipeable object to use
 * on each request.
 * @param {int} priority How early on the pipe factory it should be.
 */
Proxy.prototype.addRequestPipeFactory = function(callback, priority) {
    this.addCallback('requestPipeFactories', callback, priority);
};

/**
 * @param {callback} callback A function that returns a pipeable object to stop
 * using on each request.
 */
Proxy.prototype.removeRequestPipeFactory = function(callback) {
    this.removeCallback('requestPipeFactories', callback);
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
    this.addCallback('responsePipeFactories', callback, priority);
};

/**
 * @param {callback} callback A function that returns a pipeable object to stop
 * using on each response.
 */
Proxy.prototype.removeResponsePipeFactory = function(callback) {
    this.removeCallback('responsePipeFactories', callback);
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
