// PedalGPIO and PedalEmulator are interchangeable because they have the same events

const { EventEmitter } = require('stream');
// var { PedalGPIOServer } = require('./pedalGPIOServer.js');
var { PedalHTTPServer } = require('./emul-pedalHTTP/pedalHTTPServer.js');

class PedalServer extends EventEmitter {
	constructor(params, realPedals = false, usingPi = false) {
		super();
		this.control;
		if (realPedals) {
			// this.control = new PedalGPIOServer(params.clk, params.shift, params.pedals, params.loomRelay, params.countPins, usingPi);
		} else {
			this.control = new PedalHTTPServer(params.dir);
		}

		// this.GPIOSocket = new GPIOServer();
		console.log("gpio server created");

		this.control.on('count', (e) => 
		// {
		// 	this.GPIOSocket.sendNumPedals(e.numPedals, e.pedalStates);
		// }); 
		{
			console.log("count changed ", e);
			this.emit('count', e);
		});

		this.control.on('states', (e) => 
		// {
		// 	this.GPIOSocket.sendPedalStates(e.id, e.state, e.all);
		// }); 
		{
			console.log("pedal states change ", e);
			this.emit('states', e);
		});

		this.control.on('vacuum', () => 
		// {
		// 	this.GPIOSocket.send('v');
		// });	
		this.emit('vacuum'));
	}
}

module.exports = {
	PedalServer,
	// PedalGPIOServer,
	PedalHTTPServer
};

// physical mapping should work on any Pi
// GPIO nums will only work on the Pi Zero/certain models
// https://pinout.xyz/pinout/
if (require.main === module) {
	const defaultPins = {
		clk: 23, 		// PI23 / GPIO11 / SCLK
		shift: 24, 		// PI24 / [~W/S] GPIO8 / SPI-CE0
		pedals: 21,		// PI21 / GPIO9 / SPI-MISO
		loomRelay: 22,	// PI22 / GPIO25
		countPins: [29, 31, 33, 35] // PI 29-31-33-35 / GPIO 5-6-13-19
	}
	const ctrl = new PedalServer();
}
