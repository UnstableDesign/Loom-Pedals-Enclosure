// PedalGPIO and PedalEmulator are interchangeable because they have the same events

const { EventEmitter } = require('stream');
var { PedalGPIOServer } = require('./pedalGPIOServer.js');
var { PedalHTTPServer } = require('./emul-pedalHTTP/pedalHTTPServer.js');

class PedalDriver extends EventEmitter {
	constructor(params, realPedals = true, usingPi = true) {
		super();
		this.physicalPedals = {n: 0, states: []};
		this.virtualPedals = {n: 0, states: []};
		this.physical = null;
		this.virtual = null;
		if (realPedals && usingPi) {
			this.physical = new PedalGPIOServer(params.clk, params.shift, params.pedals, params.loomRelay, params.countPins, usingPi);
		}
		this.virtual = new PedalHTTPServer(params.dir);

		// for (ev of ['count', 'states', 'vacuum']) {
		// 	this.virtual.on(ev, (e) => this.emit(ev, e));
		// 	if (this.physical) {
		// 		this.physical.on(ev, (e) => this.emit(ev, e));
		// 	}
		// }

		if (this.physical) {
			this.physical.on('count', (e) => { 
				this.physicalPedals.n = e.numPedals;
				this.physicalPedals.states = e.pedalStates;
				this.emit('count', this.combined());
			});
			this.virtual.on('count', (e) => {
				this.virtualPedals.n = e.numPedals;
				this.virtualPedals.states = e.pedalStates;
				this.emit('count', this.combined());
			})

			this.physical.on('states', (e) => {
				this.physicalPedals.states[e.id] = e.state;
				this.emit('states', {
					id: e.id,
					state: e.state,
					all: this.physicalPedals.states
				});
			});
			this.virtual.on('states', (e) => {
				this.virtualPedals.states[e.id] = e.state;
				this.emit('states', {
					id: e.id + this.physicalPedals.n,
					state: e.state,
					all: this.combined().pedalStates
				});
			})

			this.virtual.on('vacuuum', (e) => this.emit('vacuum', e));
		}
	}

	combined() {
		return {
			numPedals: this.physicalPedals.n + this.virtualPedals.n,
			pedalStates: this.physicalPedals.states.concat(this.virtualPedals.states)
		}
	}
}

/**
 * @param usingPi is this being run on a Raspberry Pi? Or on another device (e.g. laptop)
 * @param realPedals are pedals physically connected to the Pi's GPIO? (irrelevant if usingPi = false)
 */
class PedalServer extends EventEmitter {
	constructor(params, realPedals = true, usingPi = true) {
		super();
		this.control = new PedalDriver(params, realPedals, usingPi);
		// this.physical;
		// this.virtual;
		// if (realPedals && usingPi) {
		// 	this.physical = new PedalGPIOServer(params.clk, params.shift, params.pedals, params.loomRelay, params.countPins, usingPi);
		// 	this.virtual = new PedalHTTPServer(params.dir);
		// } else {
		// 	this.virtual = new PedalHTTPServer(params.dir);
		// }

		// this.GPIOSocket = new GPIOServer();
		console.log("pedalServer: gpio server created");

		this.control.on('count', (e) => 
		{
			console.log("pedalServer: count changed ", e);
			this.emit('count', e);
		});

		this.control.on('states', (e) => 
		{
			console.log("pedalServer: pedal states change ", e);
			this.emit('states', e);
		});

		this.control.on('vacuum', () => this.emit('vacuum'));
	}

	toggleRelay() {
		this.control.physical.toggleRelay();
	}
}

module.exports = {
	PedalServer,
	PedalGPIOServer,
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
