var http = require('http');

/**
 * Set up a request factory
 * @param {string} host Host to request.
 * @param {string} port Port to request.
 * @param {string} targetport Port for the target server.
 * @return {function} Request factory.
 */
module.exports = function(host, port, targetport) {
    /**
     * Make a request
     * @param {object} options method, headers, or data to send.
     * @param {function} callback Callback when the request finishes.
     */
    return function(options, callback) {
        if (typeof options === 'function') {
            callback = options;
            options = {};
        }
        var req = http.request({
            port: port,
            hostname: host,
            method: options.method || 'GET',
            path: 'http://' + host + ':' + targetport + '/' + (
                options.url || ''),
            headers: options.headers || {}
        });
        if (options.data) {
            req.write(options.data, 'binary');
        }
        req.end();

        var r = {
            data: ''
        };
        req.on('response', function(res) {
            r.statusCode = res.statusCode;
            r.headers = res.headers;
            res.on('data', function(chunk) {
                r.data += chunk;
            });
            res.on('end', function() {
                if (callback) {
                    callback(null, r);
                    callback = null;
                }
            });
            res.on('error', function(e) {
                if (callback) {
                    callback(e);
                    callback = null;
                }
            });
        });

        req.on('error', function(e) {
            if (callback) {
                callback(e);
                callback = null;
            }
        });
    };
};
