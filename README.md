# Loom Pedals

The loom pedals are a hardware peripheral interface for the TC2 digital Jacquard loom by Tronrud Engineering. They have been designed as a modular system of foot pedals, similar to guitar effects pedals used by musicians, which are connected via a Raspberry Pi to a web-based open source weaving software, AdaCAD.

Full documentation is currently hosted [here](https://sminliwu.github.io/projects/LoomPedals/).

## System components (& directory map)

1. Hardware
  1. Circuit design
    0. Logisim
    1. Fritzing layout
    2. WaveDrom timing diagram
    3. Arduino tester program
    4. Photos of hand-assembling pedals circuit
  2. Enclosure design
    1. V1 CAD files
    2. V2 CAD files
2. Raspberry Pi software
  0. Main modules
  1. Pedals driver
    * Debugging module for emulating a set of pedals on a webpage
  2. TC2 connection *(not yet public)*
  3. Database connection
3. AdaCAD integration
  0. Wireframe sketches
  1. Services
  2. Component
