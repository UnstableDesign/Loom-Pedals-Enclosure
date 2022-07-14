const { LoomHandle } = require('../2_loomDB/LoomTCPClient');
const { PedalServer } = require('../1_pedals/pedalServer');
const { DBPipe } = require('../2_loomDB/firebaseDBPipe');

var usingPi = true;
var realLoom = true;
var realPedals = false;

const loom = new LoomHandle(6, 3, realLoom);

const defaults = {
  clk: 23, 		// PI23 / GPIO11 / SCLK
  shift: 24, 		// PI24 / [~W/S] GPIO8 / SPI-CE0
  pedals: 21,		// PI21 / GPIO9 / SPI-MISO
  loomRelay: 22,	// PI22 / GPIO25
  countPins: [29, 31, 33, 35], // PI 29-31-33-35 / GPIO 5-6-13-19
  dir: './emul-pedalHTTP/'
}
const pedals = new PedalServer(defaults, realPedals, usingPi);

const dbcon = new DBPipe(loom, pedals);
// console.log(dbcon);

dbcon.keepAlive();
// loom.vacuumOn();