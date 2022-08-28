// pins reflect the "out" side of the pedals data bus
// see right side of pedalsWiring_breadboard.pdf
#define MICROS_RES      8   // Uno has a microsecond resolution of 8 us
#define COUNT_BITWIDTH  4
#define PIN_CLK         11
#define PIN_WS          10
#define PIN_PEDAL_OUT   4
#define PIN_VCC_NEXT    2
#define PINS_COUNT_OUT  {9, 6, 5, 3}
#define PINS_SYSCOUNT   {7, 8, 12, 13}
#define PIN_SYSPEDALS   A0  // can use analog pins as digital inputs

const int sysCountPins[COUNT_BITWIDTH] = PINS_SYSCOUNT;
const int countOutPins[COUNT_BITWIDTH] = PINS_COUNT_OUT;

// system state: ctrl pins
//bool plot = true;
bool clk;
bool ws;
uint8_t count;  // max: if count is 4 bits, 15 poss pedals
bool pedals[15] = {false};   // array, reserve 2 bytes

// system state: emulator pins
uint8_t emulCount = 0;  // number of pedals to emulate BEFORE the first connected pedal
bool pedalVals[14] = {false};

// system state: time
unsigned long currentTime;
unsigned long prevClkTime;   // when clk was last changed
unsigned int wsOffset = MICROS_RES * 0;
unsigned int readOffset = MICROS_RES * 0;

uint8_t clkCounter;
uint8_t loopStage;
unsigned long clkSpeed = MICROS_RES * 50; // half period of clk

// data ready flags
bool pedalReady = false;
bool pedalOut;

void setup() {
  // configure all the pins
  Serial.begin(9600);

  // control pins:
  // outputs [2]:  clk, ~w/s
  pinMode(PIN_CLK, OUTPUT); // clk
  pinMode(PIN_WS, OUTPUT); // ~w/s
  // inputs [5]:  sys count [0-3], sys pedals
  for (int i=0; i < COUNT_BITWIDTH; i++) {
    pinMode(sysCountPins[i], INPUT);
  }
  pinMode(PIN_SYSPEDALS, INPUT); // sys pedals

  // emulation pins:
  // outputs [5]:  pedal OUT, count OUT [0-3]
  pinMode(PIN_PEDAL_OUT, OUTPUT);
  for (int i=0; i < COUNT_BITWIDTH; i++) {
    pinMode(countOutPins[i], OUTPUT);
  }
  // inputs [1]: VCC next
  pinMode(PIN_VCC_NEXT, INPUT); // really just to check if pedal is alive
  
//  loopCounter = 0;
  loopStage = 0;
}

void loop() {
//  Serial.print("loop counter: ");
//  Serial.println(loopCounter);
//  Serial.print("loop stage: ");
//  Serial.println(loopStage);
  currentTime = millis();
//  checkEmulSettings();
  switch (loopStage) {
    case 0:
      readCount();
      break;
    case 1:
      waitForPedals();  // wait for [count] clk cycles
      break;
    case 2:
      readPedals();     // read for [count] clk cycles
      break;
    default:
      break;
  }
//  Serial.println(digitalRead(A0));
//  loopCounter++;
//  if (plot) {
    plotBus();
//  }
}

void startClk() {
  clkCounter = 0;
  clk = HIGH;
  prevClkTime = currentTime;
}

void updateClk() {
  // clock half period has elapsed
  if ((currentTime - prevClkTime) >= clkSpeed) {
    prevClkTime = currentTime;
    if (!clk) { // end of CLK low half-period
      clkCounter++; // rising edge of clk unless end of read stage
      if (clkCounter > count && loopStage == 2) {
        return;
      }
    } else { // falling edge
      if (loopStage == 2) {
        pedalReady = true;
      }
    }
    clk = !clk;
  }
  digitalWrite(PIN_WS, ws);
  digitalWrite(PIN_CLK, clk);
  return;
}

void readCount() {
  count = 0;
  for (int i=0; i < COUNT_BITWIDTH; i++) {
    bool bitIn = digitalRead(sysCountPins[i]);
    count = (count << 1) | bitIn;
  }
  
  ws = LOW;
  loopStage = 1;
  startClk();
//  Serial.print("count: ");
//  Serial.println(count);
  return;
}

void waitForPedals() {
  if (clkCounter > count) {
//    clk = LOW;
    clkCounter = 0;
    ws = HIGH;
    loopStage = 2;
//    digitalWrite(PIN_WS, ws);
//    Serial.println("waited");
//    return;    
  }
  updateClk();
  return;
}

void readPedals() {
  if (count == 0 || clkCounter > count) {
    loopStage = 0;
//    printEmulPedals();
//    printPedalsArray();
    //    Serial.println("pedals read");  
    return;
  }

  updateClk();
  if (pedalReady) {
    // read in a pedal
    pedals[clkCounter] = digitalRead(PIN_SYSPEDALS);
    // reset the flag
    pedalReady = false;
  }
  return;
}

//void printEmulPedals() {
//  if (count > 0) {
//    Serial.print("[ ");
//    Serial.print(pedalVals[0]);
//    for (int i=1; i < emulCount; i++) {
//      Serial.print(", ");
//      Serial.print(pedalVals[i]);
//    }
//    Serial.println(" ]");
//  } else {
//    Serial.println("[NONE]");
//  }
//}

void printPedalsArray() {
  if (count > 0) {
    Serial.print("[ ");
    Serial.print(pedals[0]);
    for (int i=1; i < count; i++) {
      Serial.print(", ");
      Serial.print(pedals[i]);
    }
    Serial.println(" ]");
  } else {
    Serial.println("[NONE]");
  }
}

void plotBus() {
  Serial.print(clk+6);
  Serial.print(" ");
  Serial.print(loopStage+3);
  Serial.print(" ");
  Serial.print(ws+1);
  Serial.print(" ");
  Serial.print(pedalReady-1);
  Serial.print(" ");  
  if (emulCount > 0) {
    Serial.print(pedalOut-3);
    Serial.print(" ");
  }
  Serial.print(digitalRead(A0)-5);
  Serial.print(" ");
  Serial.print(pedals[0]-7);
  Serial.print(" ");
  Serial.print(pedals[1]-9);
  Serial.print(" ");
  Serial.println(pedals[2]-11);
}
