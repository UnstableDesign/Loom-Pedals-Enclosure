/*
	FILE/MODULE: pedalGPIO.js
	re-implements some of pedalGPIO.py, expanding the pedals
	to more flexible configurations

	TODO:
	- integrate with "virtual" HTTP pedals?
*/

const net = require('net');
const { EventEmitter } = require('stream');
const rpio = require('rpio');

const { InputPin, OutputPin } = require('./pins.js');

const { GPIO_TCP } = require('./tcp-config.js');

const _COUNT_BITWIDTH = 4; // this shouldn't change for now, but maybe for handling more output/inputs eventually
const debug = false;

/**
 * @class PedalGPIOState
 * @desc
 * Data object representing state of the pedal system loop.
 */
class PedalGPIOState {
	constructor() {
		this.phase = 'read-count';
		this.numPedals = 0;
		this.pedalStates = [];
		this.CLK_SPEED = 20; // quarter period
		this.clk = true;
		this.clkTicks = 0;
		this.clkBeat = 0;
		this.shift = true;
		this.event = false;
	}

	resetClk() {
		this.clk = true;
		this.clkTicks = 0;
		this.clkBeat = 0;
	}
	
	copy() {
		let o = new PedalGPIOState();
		o.phase = this.phase;
		o.numPedals = this.numPedals;
		o.pedalStates = Array.from(this.pedalStates);
		o.CLK_SPEED = this.CLK_SPEED;
		o.clk = this.clk;
		o.clkTicks = this.clkTicks;
		o.clkBeat = this.clkBeat;
		o.shift = this.shift;
		if (this.event) {
			o.event = Object.assign({}, this.event);
		} else {
			o.event = this.event;
		}

		return o;
	}
}

/**
	@class PedalGPIO
	@desc
	THIS SHOULD BE THE ONLY THING THAT DIRECTLY READS/WRITES GPIO PINS

	The hardware interface to the pedals, handling the 
	physical GPIO pins and keeping track of how many pedals 
	are connected in what input state for the rest of the 
	system.

	DOES NOT HANDLE TIMING, that's GPIOServer's job

	- if the pedal function involves loading a new pick to the loom,
		make sure to toggle the relay output pin
 * @event `'count'` 
 * -- properties: `{ numPedals: number, pedalStates: Array<boolean> }`
 * @event `'states'`
 * -- properties: `{ id: number, state: boolean, all: Array<boolean> }`
 */
class PedalGPIO extends EventEmitter {
	// output pins
	clk;	// Pi generates a clock signal
	shift; 		// ~WRITE / SHIFT in circuit diagrams
	loomRelay; 	// output pin to relay, triggers the loom to close the shed and request a new pick

	// input pins 
	pedals;		// 1 pin = pedal states (1-bit) in series
	count; 		// 4 pins in parallel = 4-bit number

	// pedal events 
	// events;
	// 'count', numPedals - when number of pedals changes
	// 'states', pedalStates - when a pedal state(s) changes

	/**
		@constructor
		
		inputs: the pin numbers that the RPi will be interfacing with
			- clk, shift, pedals, loomRelay: GPIO pin numbers
			- countPins: array of [_COUNT_BITWIDTH] GPIO pin numbers
		@param clk GPIO pin number
		@param shift GPIO pin number
		@param pedals GPIO pin number
		@param loomRelay GPIO pin number
		@param countPins array of GPIO pin numbers
		@param usingPi whether or not to use 'mock' mode
	*/
	constructor(clk, shift, pedals, loomRelay, countPins, usingPi) {
		super();

		if (!usingPi) {
			rpio.init({mock: 'raspi-zero'});
		}

		this.clk = new OutputPin(clk, rpio.HIGH, "clk");
		this.shift = new OutputPin(shift, rpio.HIGH, "shift");
		this.loomRelay = new OutputPin(loomRelay, rpio.LOW, "loom_relay");

		this.pedals = new InputPin(pedals, "sys_pedals");

		if (countPins.length == _COUNT_BITWIDTH) {
			this.count = new Array(_COUNT_BITWIDTH);
			for (var i=0; i<_COUNT_BITWIDTH; i++) {
				this.count[i] = new InputPin(countPins[i], "count-"+i);
			}
			if (debug) {
				console.log("pedalGPIO: count pins: ", this.count);
			}
		} else {
			console.log("pedalGPIO: wrong number of pins for count");
			// throw error
		}

		// this.CLK_SPEED = 20; 
		/** @todo make this better and configurable */
		
		this.state = new PedalGPIOState();

		// console.log("start gpio loop");
		this.emit('read-count', this.state);
	}

	updateClock(state) {
		let ns = state.copy();
		ns.clkBeat = (state.clkBeat + 1) % 4;
		if (ns.clkBeat == 0) {
			ns.clk = true;
			ns.clkTicks++;
			this.clk.write(rpio.HIGH);
			if (debug) {
				console.log("pedalGPIO: tick -- 0");
			}
		} else if (ns.clkBeat == 2) {
			ns.clk = false;
			this.clk.write(rpio.LOW);
			if (debug) {
				console.log("pedalGPIO: tock -- 2");
			}
		} else {
			if (debug) {
				console.log("pedalGPIO: clock beat -- ", ns.clkBeat);
			}
		}

		// if (ns.phase == 'wait-pedals') {
		// 	ns = this.waitForPedals(ns);
		// } else if (ns.phase == 'read-pedals') {
		// 	ns = this.waitForPedals(ns);
		// }

		this.emit(ns.phase, ns);
	}

	/**
		@method readCount
		@desc reads `_COUNT` array of pins, converting 
		4-bit binary number to decimal number
		- if pedal count has changed, update the rest of the system
		- when additional pedals are first connected, initialize to state 0
	*/
	readCount(state) {
		// console.log("pedalGPIO: state ", state);
		// read pins [_COUNT] as 4-bit binary
		let ns = state.copy();
		ns.numPedals = 0;
		for (var i=0; i < _COUNT_BITWIDTH; i++) {
			let pin = this.count[i];
			// numPedals = _COUNT -> decimal
			ns.numPedals += pin.read() << i;
			// if (debug) {
				// console.log("pedalGPIO: pin num ", pin.pin, " | count bit ", i, " | value ", pin.read());
				// console.log("pedalGPIO: count so far ", ns.numPedals);
			// }
		}

		// if (debug) {
		// 	console.log("pedalGPIO: pedals count ", ns.numPedals);
		// }

		if (ns.numPedals != state.numPedals) {
			console.log('pedalGPIO: num pedals changed ', ns.numPedals);
			ns.pedalStates = Array(ns.numPedals).fill(false);
			ns.event = { name: 'count'};
		}

		ns.phase = 'wait-pedals';
		ns.resetClk();
		this.emit('clock', ns);
	}

	/**
		@method waitForPedals
		@desc run clock for `numPedals` cycles to allow for user 
		input on pedals and registers to load
	*/
	waitForPedals(state) {
		let ns = state.copy(); // clone state
		// _SHIFT_EN pin (~ WRITE / SHIFT) = low
		if (ns.clkTicks == 0 && ns.clkBeat == 3) {
			if (debug) {
				console.log("pedalGPIO: wait for pedals")
			}

			ns.shift = false; // shift needs to toggle away from rising clk edges
			this.shift.write(rpio.LOW);
		} 
		
		// run clock for just for a cycle or two to give load time
		else if (ns.clkTicks > 1) {
			ns.phase = 'read-pedals';
			ns.clkTicks = 0;
			if (debug) {
				console.log("pedalGPIO: read pedals");
			}
		}

		this.emit('clock', ns);
	}

	/**
	 * @method readPedals
	 * @desc read in bits from `_PEDALS` for a duration of
	 * `numPedals` clock cycles
	 * - store bits in `pedalStates` array as booleans
	*/
	readPedals(state) {
		let ns = state.copy(); // clone state
		// _SHIFT_EN pin (~WRITE / SHIFT) = high
		// change shift signal on clock beat 1, off of the clock's rising edge (which is on clock beat 0)
		if (ns.clkBeat == 1) {
			if (ns.clkTicks == 0) {
				this.shift.write(rpio.HIGH);
			} else if (ns.clkTicks == ns.numPedals-1) {
				this.shift.write(rpio.LOW);
			}
		}

		// clock will run for numPedals + 1 ticks, because first shifted bit out is a duplicate of LSB
		else if (ns.clkTicks >= ns.numPedals && ns.clkBeat > 2) {
			ns.phase = 'read-count';
			this.emit('read-count', ns);
			return;
		}

		else if (ns.clkBeat == 2) {
			let pedal = this.pedals.read(); // read pin
			let idx = ns.numPedals - ns.clkTicks; // flip array index because first bit shifted in is the LSB
			// if there already is a count event, don't have a states event
			if (idx > -1 && idx < ns.numPedals) {
				if (!ns.event && pedal != ns.pedalStates[idx]) {
					// compare to corr. index in current pedalStates array
					ns.event = { name: 'states', id: idx };
				}
				ns.pedalStates[idx] = pedal;
			}
			if (debug) {
				console.log("pedalGPIO: BIT ", idx, " pedal ", pedal);
				console.log("pedalGPIO: ", ns.pedalStates);
			}
		}

		// run clock for [numPedals] cycles
		// if (ns.clkTicks == ns.numPedals) {
		// 	ns.phase = 'read-count';
		// 	ns.clkTicks = 0;
		// 	// ns.numPedals = 0;
			
		// 	// restart the cycle
		// 	this.emit('read-count', ns);
		// 	if (debug) {
		// 		console.log("pedalGPIO: read complete");
		// 	}
		// 	return;
		// }

		// for each bit read in from _PEDALS pin,
		// ns.clk = !state.clk;
		// if (!ns.clk) {
		// 	this.clk.write(rpio.LOW);
		// 	// if (debug) {
		// 		// console.log("pedalGPIO: tock");
		// 	// }
		// 	if (ns.clkTicks > -1) {
		// 		let pedal = this.pedals.read(); // read pin
		// 		// if there already is a count event, don't have a states event
		// 		if (!ns.event && pedal != ns.pedalStates[ns.clkTicks]) {
		// 			// compare to corr. index in current pedalStates array
		// 			ns.event = { name: 'states', id: ns.clkTicks };
		// 		}
		// 		ns.pedalStates[ns.clkTicks] = pedal;
		// 		if (debug) {
		// 			console.log("pedalGPIO: tock -- pedal pin read ", pedal);
		// 			console.log("pedalGPIO: ", ns.pedalStates);
		// 		}
		// 	}
		// } else {
		// 	// if (debug) {
		// 		// console.log("pedalGPIO: tick"); // I think data shifts on CLK HIGH?
		// 	// }
		// 	this.clk.write(rpio.HIGH);
		// 	ns.clkTicks += 1;
		// 	let pedal = this.pedals.read(); // read pin
		// 	console.log("pedalGPIO: tick -- pedal pin read ", pedal);
		// }
		
		this.emit('clock', ns);
	}

	toggleRelay() {
		this.loomRelay.toggle();
		console.log('relay ', this.loomRelay.val);
	}
}

function pedalArrayString(array) {
	var str = "";
	for (var i in array) {
		str += (array[i].state ? 't' : 'f');
	}
	return str;
}

class PedalGPIOServer extends EventEmitter {
	constructor(clk, shift, pedals, loomRelay, countPins, usingPi) {
		super();
		this.pins = new PedalGPIO(clk, shift, pedals, loomRelay, countPins, usingPi);
		const pins = this.pins;

		const boundClock = (
			function boundClock(state) {
				pins.updateClock(state);
			}).bind(pins);

		const boundReadCount = (
			function boundReadCount(state) {
				pins.readCount(state);
		}).bind(pins);
		const boundWaitPedals = (
			function boundWaitPedals(state) {
				pins.waitForPedals(state);
		}).bind(pins);
		const boundReadPedals = (
			function boundReadPedals(state) {
				pins.readPedals(state);
		}).bind(pins);

		pins.on('clock', (state) => {
			setTimeout(boundClock, state.CLK_SPEED, state);
		})

		pins.on('read-count', (state) => {
			if (debug && state.event) {
				console.log("pedalGPIOServer: read count ", state);
			}
			if (state.event) {
				if (state.event.name == 'count') {
					this.emit('count', {
						numPedals: state.numPedals,
						pedalStates: state.pedalStates
					});
				} else if (state.event.name == 'states') {
					this.emit('states', {
						id: state.event.id,
						state: state.pedalStates[state.event.id],
						all: state.pedalStates
					});
				}
			}
			state.event = false;
			boundReadCount(state);
		}); 
		pins.on('wait-pedals', (state) => {
			boundWaitPedals(state);
			// console.log("wait pedals ", state);
			// setTimeout(boundWaitPedals, state.CLK_SPEED, state);
			// pins.waitForPedals(state);
		}); 
		pins.on('read-pedals', (state) => {
			boundReadPedals(state);
			// console.log("read pedals", state);
			// setTimeout(boundReadPedals, state.CLK_SPEED, state);
			// pins.readPedals(state);
		});

		if (debug) {
			console.log("pedalGPIOServer: start reading pins", pins.state);
		}
		pins.readCount(pins.state);
	}

	toggleRelay() {
		this.pins.toggleRelay();
	}

	sendNumPedals(n, states) {
		if (this.sending) {
			this.socket.write('n,' + n.toString()+','+pedalArrayString(states));
		}
	}

	sendPedalStates(id, state, allPedals) {
		if (this.sending) {
			this.socket.write('p,'+id+','+state+','+pedalArrayString(allPedals));
		}
	}

	send(str) {
		if (this.sending) {
			this.socket.write(str);
		}
	}
}


module.exports = {
	PedalGPIOServer
};

