/**
 * FILE: pedalEmul.js
 * 
 * HTTP server for a page that mimics an array of pedals
 */

const http = require("http");
const fs = require('fs');
const url = require('url-parse');
const ws = require('ws');
const { EventEmitter } = require('stream');

/** 
 * @event `'count'` 
 * -- properties: `{ numPedals: number, pedalStates: Array<boolean> }`
 * @event `'states'`
 * -- properties: `{ id: number, state: boolean, all: Array<boolean> }`
 * @event `'vacuum'` (emulator ONLY)
 * -- properties: none, indicates user pressed vacuum toggle button on
 * emulator HTTP interface
 */
class PedalHTTPServer extends EventEmitter {
    constructor(dir) {
        super();
        const filePath = dir;
        const pedalEvents = this;
        const wsServer = new ws.Server({
            port: 8080
          });
        
        // console.log(__dirname);
        console.log("files at ", filePath);
        const httpServer = http.createServer(function (request, response) {
        
            var pathname = new url(request.url);//parse(request.url).pathname;
            console.log("Request for " + pathname + " received.");
        
            response.writeHead(200);
        
            if(pathname == "/") {
                let html = fs.readFileSync(__dirname+"/index.html", "utf8");
                response.write(html);
            } else if (pathname == "/client.js") {
                let script = fs.readFileSync(__dirname+"/client.js", "utf8");
                response.write(script);
            }
        
            response.end();
        }).listen(8888);
        
        this.httpServer = httpServer;
        console.log("HTTP server: port 8888");
        
        let sockets = [];
        wsServer.on('connection', function(socket) {
            sockets.push(socket);
          
            // When you receive a message, send that message to every socket.
            socket.on('message', function(msg) {
                // console.log(msg.toString());
                let unpacked = msg.toString().split(',');
                console.log(unpacked);
                if (unpacked[0] == 'n') {
                    console.log("pedalEmul: num pedals change");
                    pedalEvents.emit('count', {
                        numPedals: parseInt(unpacked[1]),
                        pedalStates: pedalEvents.parsePedalArray(unpacked[2])
                    });
                } else if (unpacked[0] == 'p') {
                    console.log("pedalEmul: pedal state change");
                    pedalEvents.emit('states', {
                        id: parseInt(unpacked[1]),
                        state: (unpacked[2] == 'true' ? true : false),
                        all: pedalEvents.parsePedalArray(unpacked[3])
                    });
                } else if (unpacked[0] == 'v') {
                    console.log("pedalEmul: vacuum toggle");
                    pedalEvents.emit('vacuum');
                }
            });
          
            // When a socket closes, or disconnects, remove it from the array.
            socket.on('close', function() {
              sockets = sockets.filter(s => s !== socket);
            });
          });
          
        console.log("Websockets server: port 8080");
    }

    parsePedalArray(str) {
        // console.log('parsing state string: ', str);
        var stateArray = [];
        for (var i=0; i < str.length; i++) {
            // console.log(str.charAt(i));
            stateArray.push(str.charAt(i) == 't' ? true : false);
        }
        // console.log(stateArray);
        return stateArray;
    }
}

module.exports = {
    PedalHTTPServer
}

if (require.main === module) {
    const fakePedals = new PedalHTTPServer("./");
}
