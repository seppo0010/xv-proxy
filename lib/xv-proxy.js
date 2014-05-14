var http = require('http');
var url = require('url');

/**
 * @constructor
 */
var Proxy = function() {
    this.server = http.createServer(function(request, response) {
        var options = url.parse(request.url);
        options.port = options.port || 80;
        options.method = request.method;
        options.headers = request.headers;
        var proxy_request = http.request(options, function(proxy_response) {
            proxy_response.pipe(response);
            response.writeHead(proxy_response.statusCode,
                 proxy_response.headers);
        });
        request.pipe(proxy_request);
   });
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
