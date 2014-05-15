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
            self.responseDuplexPipes.forEach(function(p) {
                r = r.pipe(p);
            });
            r.pipe(response);
            response.writeHead(proxy_response.statusCode,
                 proxy_response.headers);
        });
        var r = request;
        self.requestDuplexPipes.forEach(function(p) {
            r = r.pipe(p);
        });
        r.pipe(proxy_request);
    });
    this.requestDuplexPipes = [];
    this.responseDuplexPipes = [];
};

/**
 * @param {Duplex} pipe The Duplex to pipe each request.
 */
Proxy.prototype.addRequestDuplexPipe = function(pipe) {
   this.requestDuplexPipes.push(pipe);
};

/**
 * @param {Duplex} pipe The Duplex to stop piping each request.
 */
Proxy.prototype.removeRequestDuplexPipe = function(pipe) {
   var index;
   while ((index = this.requestDuplexPipes.indexOf(pipe)) != -1) {
      this.requestDuplexPipes.splice(index, 1);
   }
};

/**
 * @param {Duplex} pipe The Duplex to pipe each response.
 */
Proxy.prototype.addResponseDuplexPipe = function(pipe) {
   this.responseDuplexPipes.push(pipe);
};

/**
 * @param {Duplex} pipe The Duplex to stop piping each response.
 */
Proxy.prototype.removeResponseDuplexPipe = function(pipe) {
   var index;
   while ((index = this.responseDuplexPipes.indexOf(pipe)) != -1) {
      this.responseDuplexPipes.splice(index, 1);
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
