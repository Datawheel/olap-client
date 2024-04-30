const {Comparison, Format, Direction, TimePrecision} = require("../dist/index.cjs");

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
 * @param {import("..").Cube} cube
 * @param {import("..").Level[]} besides
 * @returns {import("..").Level}
 */
function randomLevel(cube, ...besides) {
  const {levels} = randomPick(randomPick(cube.dimensions).hierarchies);
  const filteredLevels = levels.filter(item => !besides.includes(item));
  const pick = randomPick(filteredLevels);
  return pick || randomLevel(cube, ...besides);
};

/**
 * @template T
 * @param {T[]} list
 * @returns {T}
 */
function randomPick(list, ...besides) {
  list = list.filter(item => !besides.includes(item));
  const index = Math.floor(Math.random() * list.length);
  return list[index];
}

/**
 * @param {import("..").Cube} cube
 * @returns {import("..").Query}
 */
function randomQuery(cube) {
  const allLevels = [...cube.levelIterator];
  const allProps = [...cube.propertyIterator];

  return cube.query
    .addCalculation("growth", {
      category: randomPick(allLevels),
      value: randomPick(cube.measures),
    })
    .addCalculation("rca", {
      category: randomPick(allLevels),
      location: randomPick(allLevels),
      value: randomPick(cube.measures),
    })
    .addCalculation("topk", {
      amount: randomPick([1,2,3,4,5]),
      category: randomPick(allLevels),
      order: randomValue(Direction),
      value: randomPick(cube.measures),
    })
    .addCaption(randomPick(allProps))
    .addCut(randomPick(allLevels), [1, 2, 3, 4], {exclusive: true})
    .addDrilldown(randomPick(allLevels))
    .addFilter(
      randomPick(cube.measures),
      [randomValue(Comparison), 100]
    )
    .addFilter(
      randomPick(cube.measures),
      [randomValue(Comparison), 100],
      "and",
      [randomValue(Comparison), 9999]
    )
    .addMeasure(randomPick(cube.measures))
    .addProperty(randomPick(allProps))
    .setFormat(randomValue(Format))
    .setLocale("es")
    .setOption("debug", true)
    .setPagination(2, 5)
    .setSorting(randomPick(cube.measures), randomValue(Direction))
    .setTime(randomValue(TimePrecision), 3);
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
  randomLevel,
  randomPick,
  randomQuery,
  randomString,
  randomValue,
}
