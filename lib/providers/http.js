var url = require('url');
var http = require('http');
var https = require('https');

/**
 * @param {object} request The server request.
 * @param {function} callback Function to call when the request is done.
 * @return {pipe} The pipeable data stream.
 */
module.exports = function(request, callback) {
    var options = url.parse(request.url);
    if (options.protocol !== 'http:' && options.protocol !== 'https:') {
        return;
    }
    var secure = options.protocol === 'https:';
    options.port = options.port || (secure ? 443 : 80);
    options.method = request.method;
    options.headers = request.headers;
    return (secure ? https : http).request(options, function(proxy_response) {
        callback(proxy_response.statusCode, proxy_response.headers,
            proxy_response);
    });
};
