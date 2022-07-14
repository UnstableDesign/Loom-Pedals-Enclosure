/**
 * FILE: client.js
 * served with index.html
 */

class Pedal {
  constructor(n) {
    this.id = n;
    this.idStr = this.id.toString();
    this.state = false;
    this.element = document.createElement("button");
    this.element.id = this.idStr;
    this.update();
  }

  update() {
    if (this.state) {
      this.element.innerText = this.idStr + ": true";
    } else {
      this.element.innerText = this.idStr + ": false";
    }
  }

  toggle() {
    this.state = !this.state;
    this.update();
  }
}

const ws = new WebSocket('ws://localhost:8080');
const pedalArrayDiv = document.getElementById('pedal-array');
const addButton = document.getElementById('add-pedal');
const remButton = document.getElementById('rem-pedal');
var numPedals = 0;
var pedalsArray = [];

function addPedal() {
  var p = new Pedal(numPedals);
  pedalsArray.push(p);
  numPedals += 1;
  p.element.onclick = togglePedal; 
  pedalArrayDiv.appendChild(p.element);
  checkNumPedals();
}

function removePedal() {
  var remove = pedalsArray.pop();
  pedalArrayDiv.removeChild(remove.element);
  numPedals -= 1;
  checkNumPedals();
}

function checkNumPedals() {
  if (numPedals < 1) {
    remButton.setAttribute('disabled', true);
    addButton.removeAttribute('disabled');
  } else if (numPedals >= 15) {
    remButton.removeAttribute('disabled');
    addButton.setAttribute('disabled', true);
  } else {
    remButton.removeAttribute('disabled');
    addButton.removeAttribute('disabled');
  }
  ws.send('n,'+ numPedals.toString()+','+pedalArrayString());
}

function pedalArrayString() {
  var str = "";
  for (var i in pedalsArray) {
    str += (pedalsArray[i].state ? 't' : 'f');
  }
  return str;
}

function togglePedal(e) {
  let id = e.target.id;
  console.log(e.target.id);
  pedalsArray[parseInt(id)].toggle();
  ws.send('p,'+id+','+pedalsArray[e.target.id].state + ',' + pedalArrayString());
}

function toggleVacuum() {
  ws.send('v');
}