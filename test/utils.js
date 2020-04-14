/**
 * @param {string} string
 */
function decode(string) {
  return decodeURIComponent(string.replace(/\+/g, "%20"));
}

/**
 * @param {string | number | boolean} string
 */
function encode(string) {
  return encodeURIComponent(string).replace(/%20/g, "+");
}

/**
 * @template T
 * @param {T} obj
 * @returns {keyof T}
 */
function randomKey(obj) {
  return randomPick(Object.keys(obj));
}

/**
 * @template T
 * @param {T[]} list
 * @returns {T}
 */
function randomPick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/** @returns {string} */
function randomString() {
  return Math.random().toString(16).substr(2);
}

/**
 * @template T
 * @param {T} obj
 * @returns {T[keyof T]}
 */
function randomValue(obj) {
  return obj[randomKey(obj)];
}

module.exports = {
  decode,
  encode,
  randomPick,
  randomString,
  randomValue,
}
