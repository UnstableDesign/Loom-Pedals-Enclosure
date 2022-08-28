void emulatePedals() {
  // write emulCount to count OUT pins
  static uint8_t actualCount;
  actualCount = count - emulCount;
  for (int i=0; i < COUNT_BITWIDTH; i++) {
    bool bitOut = emulCount & (1 << i);
    digitalWrite(countOutPins[i], bitOut);
  }

  // during read stage, push out the corresponding number of 0's
  // to pedals OUT pin
  if (loopStage == 2) {
    if (clk && clkCounter >= actualCount-1 && clkCounter < count) {
      pedalOut = pedalVals[clkCounter-actualCount+1];
    }
    digitalWrite(PIN_PEDAL_OUT, pedalOut);
  }
}

void checkEmulSettings() {
  if (Serial.available()) {
    String inStr = Serial.readStringUntil('\n');
//    Serial.println(inStr);
    if (inStr[0] == 'e') {
//      if (Serial.available() == 1) {
        char amt = inStr[1];
        if (amt == '+') {
          emulCount++;
        } else if (amt == '-') {
          emulCount--;
        } else if (amt == '0') {
          emulCount = 0;
        } else if (isDigit(amt)) {
          emulCount = amt-48;
        }
        Serial.print("emul ");
        Serial.println(emulCount);
    } else if ( inStr[0] == 'p') {
      Serial.println(inStr);
      for (int i=0; i < inStr.length()-1; i++) {
//        if (Serial.available()) {
          char nxt = inStr[i+1];
          if (nxt == '1' || nxt == 1) {
            pedalVals[i] = true;
//          }
        } else {
          pedalVals[i] = false;
        }
      }
    }
  }
  if (emulCount > 0) {
    emulatePedals();
  }
}
