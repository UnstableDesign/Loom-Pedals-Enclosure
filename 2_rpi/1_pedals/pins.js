const net = require('net');
const { EventEmitter } = require('stream');
const { PedalHTTPServer } = require('./emul-pedalHTTP/pedalHTTPServer.js');
const rpio = require('rpio');

const debug = false;

class Pin {
	constructor(num, mode, initVal, name="") {
		if (name != "") {
			this.name = name;
		}
		this.pin = num;
		rpio.open(num, mode, initVal);
	}
}

class InputPin extends Pin {
	constructor(num, name="") {
		super(num, rpio.INPUT, rpio.LOW, name);
	}

	read() {
		if (debug) {
			console.log("pins.js: reading input pin", this.name);
		}
		return rpio.read(this.pin);
	}

	get val() {
		return this.read();
	}
}

class OutputPin extends Pin {
	constructor(num, initVal, name="") {
		super(num, rpio.OUTPUT, initVal, name);
		this.val = initVal;
	}

	write(x) {
		if (debug) {
			console.log("pins.js: writing output pin", this.name, x);
		}
		this._val = x;
		rpio.write(this.pin, x);
	}

	get val() {
		return this._val;
	}

	set val(x) {
		this.write(x);
	}

	toggle() {
		console.log("pins.js: toggling pin from ", this.val);
		let v = (this.val == rpio.HIGH) ? rpio.LOW : rpio.HIGH;
		this.write(v);
	}
}

module.exports = {
  InputPin,
  OutputPin
}