/* The "caboose" of the pedals test bed.
 * Emulates any pedals connected in series downstream of the
 * last physical pedal being tested.
 * 
 * 
 */

// pins reflect the "in" side of the pedals data bus
// see left side of pedalsWiring_breadboard.pdf
#define COUNT_BITWIDTH  4
#define BUS_BITWIDTH    13

#define PIN_VCC_IN      A0
#define PIN_CLK         10
#define PIN_WS          9
#define PIN_PEDAL_IN    8
#define PIN_VCC_PREV    7

#define PIN_COUNT0      A4
#define PIN_COUNT1      A3
#define PIN_COUNT2      A2
#define PIN_COUNT3      A1
#define PINS_COUNT_IN   {PIN_COUNT0, PIN_COUNT1, PIN_COUNT2, PIN_COUNT3}

#define PIN_SYSCOUNT0   6
#define PIN_SYSCOUNT1   5
#define PIN_SYSCOUNT2   4
#define PIN_SYSCOUNT3   3
#define PINS_SYSCOUNT   {PIN_SYSCOUNT0, PIN_SYSCOUNT1, PIN_SYSCOUNT2, PIN_SYSCOUNT3}
#define PIN_SYSPEDALS   2 

#define DATA_CLK        0
#define DATA_WS         1
#define DATA_PEDAL_IN   2
#define DATA_VCC_PREV   3
#define DATA_COUNT0     4
#define DATA_COUNT1     5
#define DATA_COUNT2     6
#define DATA_COUNT3     7
#define DATA_SYSCOUNT0  8
#define DATA_SYSCOUNT1  9
#define DATA_SYSCOUNT2  10
#define DATA_SYSCOUNT3  11
#define DATA_SYSPEDALS  12

// pin info stored
const int sysCountPins[COUNT_BITWIDTH] = PINS_SYSCOUNT;
const int countInPins[COUNT_BITWIDTH] = PINS_COUNT_IN;
const int pinMap[BUS_BITWIDTH] = {  PIN_CLK,
                                    PIN_WS,
                                    PIN_PEDAL_IN,
                                    PIN_VCC_PREV,
                                    PIN_COUNT0,
                                    PIN_COUNT1,
                                    PIN_COUNT2,
                                    PIN_COUNT3,
                                    PIN_SYSCOUNT0,
                                    PIN_SYSCOUNT1,
                                    PIN_SYSCOUNT2,
                                    PIN_SYSCOUNT3,
                                    PIN_SYSPEDALS };
const bool ioMap[BUS_BITWIDTH] = {  INPUT, 
                                    INPUT, 
                                    INPUT,
                                    OUTPUT,
                                    INPUT,
                                    INPUT,
                                    INPUT,
                                    INPUT,
                                    OUTPUT,
                                    OUTPUT,
                                    OUTPUT,
                                    OUTPUT,
                                    OUTPUT };

// system state: pin data
unsigned int en = 0;      // VCC in from upstream pedal (checking input voltage drop)
bool bus[BUS_BITWIDTH];  // array for all 13 lines on data bus
bool prevBus[BUS_BITWIDTH];

// system state: emulator
uint8_t emulCount = 1; // num pedals to emulate AFTER inputs
uint8_t countIn;  // from prev pedals upstream
bool firstShift = false;
bool pedalVals[14] = {false}; // values for emulated pedals
bool emulRegisters[14] = {false};
bool allPedals[15] = {false};

void setup() {
  // initialize pins
  Serial.begin(9600);
  for (int i=0; i < BUS_BITWIDTH; i++) {
    pinMode(pinMap[i], ioMap[i]);
  }
}

void loop() {
  en = analogRead(PIN_VCC_IN);
//  Serial.println(analogRead(PIN_VCC_IN));
  checkEmulSettings();
  if (en > 100) {
    if (emulCount > 0) {
      bus[DATA_VCC_PREV] = HIGH;
    } else {
      bus[DATA_VCC_PREV] = LOW;    
      updateBus();
      plotBus();
      return;
    }
    updateBus();
    readCount();
    if (countIn > 0 && risingEdge(DATA_CLK)) {
      if (risingEdge(DATA_WS)) {
//        loadEmulPedals();
        firstShift = true;
      }
      if (bus[DATA_WS]) {
        // shift in pedal
        shiftPedals();
      } else {
        // update allPedals from pedalVals
        writeRegisters();
      }
    }
//    updateBus();
  }
  plotBus();
}

void updateBus() {
  copyBusData();
  for (int i=0; i < BUS_BITWIDTH; i++) {
    if (ioMap[i] == INPUT) {
      bus[i] = digitalRead(pinMap[i]);
    } else {
      digitalWrite(pinMap[i], bus[i]);
    }
  }
}

void copyBusData() {
  for (int i=0; i < BUS_BITWIDTH; i++) {
    prevBus[i] = bus[i];
  }
}

void readCount() {
  countIn = 0;
  // bus 4-7 is count IN
  for (int i=0; i < COUNT_BITWIDTH; i++) {
    bool bitIn = bus[DATA_COUNT0+i];
//    Serial.print("count ");
//    Serial.print(i);
//    Serial.print(": ");
//    Serial.println(bitIn);
    countIn = (countIn << 1) | bitIn;
  }
//  
//  Serial.print("count: ");
//  Serial.print(countIn);
//  Serial.print(" | emul: ");
//  Serial.println(emulCount);
  updateBus();
  return;
}

bool risingEdge(int inputSignal) {
  if (bus[inputSignal] && prevBus[inputSignal]) {
    return true;
  } else {return false;}
}

void loadEmulPedals() {
  // load emulated pedals vals into emulRegisters
  for (int i=0; i < emulCount; i++) {
    emulRegisters[i] = pedalVals[i];
  }
}

void shiftPedals() {
  bus[DATA_SYSPEDALS] = emulRegisters[emulCount-1]; // shift out
  updateBus();
  
  for (int i=emulCount; i > 0; i--) {
    emulRegisters[i] = emulRegisters[i-1]; 
    allPedals[i] = allPedals[i-1];
  }
  emulRegisters[0] = bus[DATA_PEDAL_IN];

  if (firstShift) {
    allPedals[0] = bus[DATA_PEDAL_IN];
    firstShift = false; // clear flag
  }
  updateBus();
}

void writeRegisters() {
  for (int i=0; i<emulCount; i++) {
    emulRegisters[i] = pedalVals[i];
    allPedals[i+emulCount] = pedalVals[i];
  }
  bus[DATA_SYSPEDALS] = emulRegisters[emulCount-1]; // write last register's value
  updateBus();
}

void plotBus() {
  for (int i=0; i<BUS_BITWIDTH-1; i++) {
    Serial.print(bus[i]+ BUS_BITWIDTH -2*i);
    Serial.print(" ");
  }
  Serial.println(bus[BUS_BITWIDTH-1]-13);
}
