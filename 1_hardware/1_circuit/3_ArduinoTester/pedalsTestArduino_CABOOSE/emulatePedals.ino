void emulatePedals() {
  // write total count to SYSCOUNT OUT pins
  int count = countIn + emulCount;
  for (int i=0; i < COUNT_BITWIDTH; i++) {
    bool bitOut = count & (1 << i);
    bus[DATA_SYSCOUNT0+i] = bitOut;
  }
//
//  // during read stage, push out the corresponding number of 0's
//  // to pedals OUT pin
//  if (loopStage == 2) {
//    if (clk && clkCounter >= actualCount-1 && clkCounter < count) {
//      pedalOut = pedalVals[clkCounter-actualCount+1];
//    }
//    digitalWrite(PIN_PEDAL_OUT, pedalOut);
//  }
  updateBus();
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

void printPedalsArray() {
  int count = countIn+emulCount;
  if (count > 0) {
    Serial.print("[ ");
    Serial.print(allPedals[0]);
    for (int i=1; i < count; i++) {
      Serial.print(", ");
      Serial.print(allPedals[i]);
    }
    Serial.println(" ]");
  } else {
    Serial.println("[NONE]");
  }
}
