/**
 * DBNode.js
 */

 const { ref, get, push, remove, set, onValue } = require("firebase/database");
 const { EventEmitter } = require('stream');

 class DBNode extends EventEmitter {
  _name;   // path string
  _dbref;    // DatabaseReference
  _val;    // data @ path

  // params = { db, root, path, initVal }
  // OR   = { ref, key, initVal }
  /**
   * 
   * @param {*} params \{ db, root, path, initVal }
   * @param {*} params \{ ref, key, initVal }
   */
  constructor(params) {
      super();
      if (params.db) {
        console.log(params.path);
        // console.log(db);
        this._name = params.path;
        this._dbref = ref(params.db, params.root + params.path);
        // console.log(this.ref);
        this._val = params.initVal;
      } else if (params.ref) {
        console.log(params.key);
        this._name = params.key;
        this._dbref = params.ref;
      }
  }

  get ref() {
    return this._dbref;
  }

  get name() {
    return this._name;
  }

  get val() {
    return this._val;
  }

  set val(x) {
    this._val = x;
  }
}

class DBListener extends DBNode {
  constructor(params) {
      super(params);
      // console.log(this.ref);
      // this.onChange = new EventEmitter();
  }

  attach() {
      // console.log(this.ref);
      const detach = onValue(this.ref, (snapshot) => {
          this.val = snapshot.val();
          this.emit('change', this.val);
      });

      Object.defineProperty(this, 'detach', {value: detach});
  }

  detach() {}
}

class DBWriter extends DBNode {
  constructor(params) {
      super(params);
      // onSetCompleted = new EventEmitter();
  }

  attach() {
      const setVal = (x) => {
          this.val = x;
          set(this.ref, this.val)
              .then(() => { this.emit('set', true); })
              .catch(() => { this.emit('set', false); });
      }
      Object.defineProperty(this, 'setVal', {value: setVal});
      Object.defineProperty(this, 'detach', 
      { value: () => delete this.setVal});
  }

  setVal(x) {}
  detach() {}
}

class OnlineStatus extends DBNode {
  constructor(params, host = true) {
      super(params);
      this.host = host;
  }

  attach() {
    const detachDB = onValue(this.ref, (snapshot) => {
      this.val = snapshot.val();
      this.emit('change', this.val);
    });

    if (this.host) {
      const setVal = (x) => {
        this.val = x;
        set(this.ref, this.val)
          .then(() => { this.emit('set', true); })
          .catch(() => { this.emit('set', false); });
      }
      Object.defineProperty(this, 'setVal', { value: setVal });
      Object.defineProperty(this, 'detach', { value: () => {
        detachDB;
        delete this.setVal;
      }});
    }
  }
  
  setVal(x) {}
  detach() {}
}

/**
* @class DBNodeArray
* @desc An object representing DBNodes that correspond to an array
* e.g. an array of loom pedals in the database would look like
*  > ```num-pedals: 3,```
*  >
*  > ```pedal-states: {```
*  >
*  >> ```   "0": true,```
*  >>
*  >> ```   "1": false,```
*  >>
*  >> ```   "2": true```
*  >
*  > `}`
*/
class DBNodeArray extends EventEmitter {
  constructor(lengthNode, parentNode, init = {}) {
      super();
      this.lengthNode = lengthNode;
      this.parentNode = parentNode;
      if (init.length) {
      } else {
        this.nodes = [];
      }
  }

  get length() {
    return this.nodes.length;
  }

  nodeAt(n) {
    console.log(this.nodes);
    console.log("node at ", n);
    console.log(this.nodes[n]);
    return this.nodes[n];
  }

  pushNode(n) {
    this.nodes.push(n);
  }

  popNode() {
    return this.nodes.pop();
  }
}

const EMPTY_NODE_ARRAY = false;

class DBWriterArray extends DBNodeArray {
  constructor(lengthNode, parentNode, init) {
    super(lengthNode, parentNode, init);
    if (!init.length) {
      this.lengthNode.setVal(0);
      this.parentNode.setVal(EMPTY_NODE_ARRAY);
    }

    // console.log(this);
  }

  addNode(initVal) {
    const childRef = push(this.parentNode.ref, initVal);
    const childNode = new DBWriter({ node: this.parentNode, ref: childRef, initVal });
    childNode.attach();
    this.pushNode(childNode);
    this.lengthNode.setVal(this.length);
  }

  remNode() {
    const node = this.popNode();
    remove(node.ref);
    this.lengthNode.setVal(this.length);
  }

  updateArray(num, newStates) {
    if (num > this.length) {
      while (this.length < num) {
        this.addNode(newStates[this.length]);
      }
    } else if (num < this.length) {
      while (this.length > num) {
        this.remNode();
      }
    }
  }

  setNode(i, x) {
    this.nodes[i].setVal(x);
  }

}

module.exports = {
  DBListener,
  DBWriter,
  OnlineStatus,
  DBWriterArray
}