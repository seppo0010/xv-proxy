var express = require('express');
var app = express();
var http = require('http');
var socketio = require('socket.io');
var zlib = require('zlib');

/**
 * Web Viewer object
 * @param {object} recorder An object that implements the recorder interface.
 * @constructor
 */
var WebViewer = module.exports = function(recorder) {
    this.server = http.createServer(app);
    var io = socketio.listen(this.server);

    app.use('/', express.static(__dirname + '/static'));
    io.sockets.on('connection', function(socket) {
        recorder.on('request:end', function(request) {
            socket.emit('requests:add', request);
        });
        recorder.list_requests(function(err, requests) {
            if (err) {
                throw err;
                return;
            }
            socket.emit('requests:initial', requests);
        });
        socket.on('request:get', function(requestId) {
            recorder.get_request(requestId, function(err, request) {
                if (err) {
                    console.error(err);
                    return;
                }
                var encodings = {
                    gzip: zlib.gunzip,
                    deflate: zlib.createInflate
                };

                if (request.response_headers &&
                    encodings[request.response_headers['content-encoding']]) {
                    encodings[request.response_headers['content-encoding']](
                            new Buffer(request.response_data, 'binary'),
                            function(err, buffer) {
                        if (err) {
                            console.error(err);
                            return;
                        }
                        request.response_data = buffer.toString('binary');
                        socket.emit('request:info', request);
                    });
                } else {
                    socket.emit('request:info', request);
                }
            });
        });
    });
};

/**
 * Start server
 * @param {number} port Port to run the web server.
 * @param {string} host Host to listen.
 * @param {function} callback Function to call once it's ready.
 */
WebViewer.prototype.listen = function(port, host, callback) {
    this.server.listen(port, host, callback);
};

/**
 * Stop server
 * @param {function} callback Function to call once it's stopped.
 */
WebViewer.prototype.close = function(callback) {
    this.server.close(callback);
};
