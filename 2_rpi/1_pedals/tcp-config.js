/** 
 * tcp-config.js
 */

GPIO_TCP = {
  port: 6969,
  host: '127.0.0.1'
}

GPIO_EMUL_HTTP = {
  port: 8888,
  host: '127.0.0.1'
}

LOOM_EMUL_TCP = {
  port: 1337,
  host: '127.0.0.1'
}

module.exports = {
  GPIO_TCP, GPIO_EMUL_HTTP, LOOM_EMUL_TCP
}