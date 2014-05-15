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
            self.responsePipeFactories.forEach(function(p) {
                r = r.pipe(p(request, response));
            });
            r.pipe(response);
            response.writeHead(proxy_response.statusCode,
                 proxy_response.headers);
        });
        var r = request;
        self.requestPipeFactories.forEach(function(p) {
            r = r.pipe(p(request, response));
        });
        r.pipe(proxy_request);
    });
    this.requestPipeFactories = [];
    this.responsePipeFactories = [];
};

/**
 * @param {PipeFactory} pf A function that returns a pipeable object to use on
 * each request.
 */
Proxy.prototype.addRequestPipeFactory = function(pf) {
   this.requestPipeFactories.push(pf);
};

/**
 * @param {PipeFactory} pf A function that returns a pipeable object to stop
 * using on each request.
 */
Proxy.prototype.removeRequestPipeFactory = function(pf) {
   var index;
   while ((index = this.requestPipeFactories.indexOf(pf)) != -1) {
      this.requestPipeFactories.splice(index, 1);
   }
};

/**
 * @param {PipeFactory} pf A function that returns a pipeable object to use on
 * each response.
 */
Proxy.prototype.addResponsePipeFactory = function(pf) {
   this.responsePipeFactories.push(pf);
};

/**
 * @param {PipeFactory} pf A function that returns a pipeable object to stop
 * using on each response.
 */
Proxy.prototype.removeResponsePipeFactory = function(pf) {
   var index;
   while ((index = this.responsePipeFactories.indexOf(pf)) != -1) {
      this.responsePipeFactories.splice(index, 1);
   }
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
