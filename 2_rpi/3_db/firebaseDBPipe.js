/**
 * FILE: firebasePi.js
 */

const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, set, onValue, push } = require("firebase/database");
const { EventEmitter } = require('stream');
const { LoomHandle } = require('./LoomTCPClient');
const { PedalServer } = require('../1_pedals/pedalServer_PC');
const { getFirebaseConfig } = require('./firebase-config.js');
const { DBWriter, DBListener, OnlineStatus, DBWriterArray } = require('./DBNode.js');

/**
 * Wraps all DBNodes into a single object that represents the
 * loom/pedal/AdaCAD state in the database.
 */
class DBStatus extends EventEmitter {
    pi_online;     // is the pi online?
    loom_online;   // is the loom online?
    vacuum_on;     // is the loom running? (vacuum pump running)
    active_draft;
    num_pedals;
    pedal_states;
    loom_ready;
    num_picks;
    pick_data;

    pedal_array;    // DBWriterArray

    constructor(db) {
        // console.log(db);
        super();
        const defaults = {
            pi_online: true,
            loom_online: false,
            vacuum_on: false,
            num_pedals: 0,
            pedal_states: false,
            loom_ready: false
        }
        const listeners = {
            active_draft: 'active-draft',
            num_picks: 'num-picks',
            pick_data: 'pick-data'
        }

        const writers = {
            loom_online: 'loom-online',
            vacuum_on: 'vacuum-on',
            num_pedals: 'num-pedals',
            pedal_states: 'pedal-states',
            loom_ready: 'loom-ready'
        }

        const params = {
            db: db,
            root: 'pedals/',
            path: 'pi-online',
            initVal: defaults.pi_online
        }

        this.pi_online = new OnlineStatus(params);
        this.pi_online.attach();
        this.pi_online.setVal(true);
        // this.loom_online = new OnlineStatus(db, 'loom-online', defaults[this.loom_online]);
        // this.loom_online.attach();

        for (var l in listeners) {
            params.path = listeners[l];
            params.initVal = defaults[l];
            var newL = new DBListener(params);
            Object.defineProperty(this, l, { value: newL });
            this[l].attach();
        }
      
        for (var w in writers) {
            params.path = writers[w];
            params.initVal = defaults[w];
            var newW = new DBWriter(params);
            Object.defineProperty(this, w, { value: newW });
            this[w].attach();
            this[w].setVal(defaults[w]);
        }

        this.pedal_array = new DBWriterArray(this.num_pedals, this.pedal_states, {});
    }
}

const waiting = {
    none: -1,
    loom: 0,
    pick: 1,
    pedals: 2
}

class LoomPedalState {
    _pedals;
    _loom;
    _weaving;

    constructor() {
        this._loom = false;
        this._pedals = false;
        this._weaving = false;
        this.weavingState = -1;
    }

    get readyToWeave() { return this._pedals && this._loom}
    get weaving() { return this._weaving }
    set weaving(x) { 
        this._weaving = x;
        if (!x) { this.weavingState = waiting.none; }
        else { this.weavingState = waiting.pedals; } 
    }

    get waitingOnPedals() { return this.weaving == waiting.pedals }
    get waitingOnLoom() { return this.weaving == waiting.loom }
    get waitingOnPick() { return this.weaving == waiting.pick }

    nextWeavingStep() {
        if (this.weaving) {
            this.weavingState = (this.weavingState + 1) % 3;
        }
    }
}

// event handlers
const setLoomReady = () => this.loom_ready.setVal(true);
const sendDBPick = (pickData) => this.loom.sendPick(pickData);

/**
 * Makes sure that state of the loom and pedals 
 * are formatted and written correctly to database
 */
class DBPipe extends EventEmitter {
    db;
    dbstatus;
    loom;
    pedals;
    lpstate;

    constructor(loomHandle, pedalsHandle) {
        super();
        const config = getFirebaseConfig();
        const app = initializeApp(config);
        
        this.db = getDatabase(app);
        this.lpstate = new LoomPedalState();

        // loom/pedal events -> DBwriter actions in methods
        this.loom = loomHandle;
        this.loom.on('connection', (e) => this.updateLoomOnline(e));
        this.loom.on('vacuum', (e) => this.updateVacuumOn(e));
        this.loom.on('pick-request', (e) => this.updateLoomReady(e));
        
        this.pedals = pedalsHandle;
        this.pedals.on('count', (e) => this.updatePedalNum(e));
        this.pedals.on('states', (e) => this.updatePedalStates(e));
        this.pedals.on('vacuum', () => { // only with fake HTTP pedals
            let vac = !this.dbstatus.vacuum_on.val;
            this.updateVacuumOn(vac);
        });

        // DBlistener events -> loom/pedal actions
        //  event handlers in methods
        this.dbstatus = new DBStatus(this.db);
        this.dbstatus.pi_online.on('change', (e) => this.keepAlive());
        this.dbstatus.active_draft.on('change', (e) => this.handleActiveDraft(e));
        this.dbstatus.pick_data.on('change', (e) => this.handlePickData(e));
    }

    /** When loom goes online/offline */
    updateLoomOnline(dbstatus) {
        this.dbstatus.loom_online.setVal(dbstatus);
    }

    /** When vacuum pump goes on/off */
    updateVacuumOn(dbstatus) {
        this.dbstatus.vacuum_on.setVal(dbstatus);
    }

    /** When the loom sends a pick request */
    updateLoomReady(dbstatus) {
        console.log("dbPipe: loom pick request");
        this.dbstatus.loom_ready.setVal(dbstatus);
    }

    /** When the number of pedals changes */
    updatePedalNum(event) {
        console.log("dbPipe: num pedals change");
        console.log(event);
        this.dbstatus.pedal_array.updateArray(event.numPedals, event.pedalStates);
    }

    /** When the pedal states change but NOT NUM */
    updatePedalStates(event) {
        console.log("dbPipe: pedal states change");
        console.log(event);
        // this.pedals.toggleRelay();
        this.dbstatus.pedal_array.setNode(event.id, event.state);
    }

    handleActiveDraft(active) {
        if (active) {
            // start listening for "loom ready" pick requests
            // this.loom.on('pick-request', setLoomReady);
            this.startWeaving();
        } else {
            // this.loom.removeEventListener('pick-request', setLoomReady);
            this.loom.vacuumOff();
        }
        // this.updateVacuumOn(vacuum);
    }

    // startWeaving() {
	// 	// short sequence of events: user sends "active draft" from software indicating weaving start
	// 	this.loom.once('vacuum', (v) => {
	// 		if (v) {
	// 			this.loom.once('vacuum', () => {
    //                 this.loom.on('pick-request', 
	// 				this.sendPick(firstPick);
	// 				this.
	// 			}
	// 		}
	// 	})
	// 	this.vacuumOn();

	// 	// pi sends vacuum on
	// 	// loom sends confirm 1
	// 	// loom sends confirm 2
	// 	// pi toggles relay for loom to open shed
	// }

    /** data comes in as a string from DB */
    handlePickData(data) {
        console.log("dbPipe: ", data);
        if (data) {
            let pickNum = this.dbstatus.num_picks.val;
            console.log("dbPipe: loom pick: "+this.loom.pickNumber+ " / db pick: "+pickNum);
            if (pickNum == 0) {
                this.pedals.toggleRelay();
            }
            let dataArray = [];
            for (var i of data) {
                let x = (parseInt(i) == 1) ? true : false;
                dataArray.push(x);
            } 
            this.loom.sendPick(dataArray);
            // console.log("dbPipe: ", dataArray);
        }
    }

    /** Maintaining pi_online when running */
    keepAlive() {
        this.dbstatus.pi_online.setVal(true);
        console.log("dbPipe: stayin' alive");
    }
}

module.exports = {
    DBPipe,
    LoomHandle,
    PedalServer
}

// true if this file is run via command line, but
// false if run by a require statement
if (require.main === module) {
    // var usingPi = false;
    var realLoom = false;
    var realPedals = false;

    const loom = new LoomHandle(6, 3, realLoom);
    const pedals = new PedalServer();
    const dbcon = new DBPipe(loom, pedals);

    dbcon.keepAlive();
    // jean_luc.vacuumOn();
    // jean_luc.vacuumOff();
}