// @ts-check
const { AggregatorType, DimensionType } = require("..");
const { randomPick, randomString, randomValue } = require("./utils");

module.exports = {
  dummyCubeBuilder,
  dummyMemberBuilder,
  dummyDatumFactory,
}

const WORDLIST = ["aardvark", "absurd", "accrue", "acme", "adrift", "adult", "afflict", "ahead", "aimless", "algol", "allow", "alone", "ammo", "ancient", "apple", "artist", "assume", "athens", "atlas", "aztec", "baboon", "backfield", "backward", "banjo", "beaming", "bedlamp", "beehive", "beeswax", "befriend", "belfast", "berserk", "billiard", "bison", "blackjack", "blockade", "blowtorch", "bluebird", "bombast", "bookshelf", "brackish", "breadline", "breakup", "brickyard", "briefcase", "burbank", "button", "buzzard", "cement", "chairlift", "chatter", "checkup", "chisel", "choking", "chopper", "christmas", "clamshell", "classic", "classroom", "cleanup", "clockwork", "cobra", "commence", "concert", "cowbell", "crackdown", "cranky", "crowfoot", "crucial", "crumpled", "crusade", "cubic", "dashboard", "deadbolt", "deckhand", "dogsled", "dragnet", "drainage", "dreadful", "drifter", "dropper", "drumbeat", "drunken", "dupont", "dwelling", "eating", "edict", "egghead", "eightball", "endorse", "endow", "enlist", "erase", "escape", "exceed", "eyeglass", "eyetooth", "facial", "fallout", "flagpole", "flatfoot", "flytrap", "fracture", "framework", "freedom", "frighten", "gazelle", "geiger", "glitter", "glucose", "goggles", "goldfish", "gremlin", "guidance", "hamlet", "highchair", "hockey", "indoors", "indulge", "inverse", "involve", "island", "jawbone", "keyboard", "kickoff", "kiwi", "klaxon", "locale", "lockup", "merit", "minnow", "miser", "mohawk", "mural", "music", "necklace", "neptune", "newborn", "nightbird", "oakland", "obtuse", "offload", "optic", "orca", "payday", "peachy", "pheasant", "physique", "playhouse", "pluto", "preclude", "prefer", "preshrunk", "printer", "prowler", "pupil", "puppy", "python", "quadrant", "quiver", "quota", "ragtime", "ratchet", "rebirth", "reform", "regain", "reindeer", "rematch", "repay", "retouch", "revenge", "reward", "rhythm", "ribcage", "ringbolt", "robust", "rocker", "ruffled", "sailboat", "sawdust", "scallion", "scenic", "scorecard", "scotland", "seabird", "select", "sentence", "shadow", "shamrock", "showgirl", "skullcap", "skydive", "slingshot", "slowdown", "snapline", "snapshot", "snowcap", "snowslide", "solo", "southward", "soybean", "spaniel", "spearhead", "spellbind", "spheroid", "spigot", "spindle", "spyglass", "stagehand", "stagnate", "stairway", "standard", "stapler", "steamship", "sterling", "stockman", "stopwatch", "stormy", "sugar", "surmount", "suspense", "sweatband", "swelter", "tactics", "talon", "tapeworm", "tempest", "tiger", "tissue", "tonic", "topmost", "tracker", "transit", "trauma", "treadmill", "trojan", "trouble", "tumor", "tunnel", "tycoon", "uncut", "unearth", "unwind", "uproot", "upset", "upshot", "vapor", "village", "virus", "vulcan", "waffle", "wallet", "watchword", "wayside", "willow", "woodlark", "zulu"];

/** @return {import("..").AdaptedCube} */
function dummyCubeBuilder(cubeName = randomString()) {
  const uri = `test://dummy.olap/${cubeName}`;
  const fnIndex = uri.indexOf(cubeName);
  return {
    _type: "cube",
    annotations: {},
    caption: "Cube: " + cubeName,
    dimensions: Array(cubeName.length).fill(uri).map(makeDummyDimension),
    fullName: `/${cubeName}`,
    measures: Array(2).fill(uri).map(makeDummyMeasure),
    name: cubeName,
    namedsets: [],
    uri,
  }

  /** @return {import("..").AdaptedMeasure} */
  function makeDummyMeasure(parentUri) {
    const name = randomString();
    return {
      _type: "measure",
      aggregatorType: randomValue(AggregatorType),
      annotations: {},
      caption: "Measure: " + name,
      cube: cubeName,
      fullName: `/${cubeName}/MEA${name}`,
      name,
      uri: `${parentUri}/MEA${name}`,
    }
  }

  /** @return {import("..").AdaptedDimension} */
  function makeDummyDimension(parentUri) {
    const name = randomString();
    const uri = `${parentUri}/DIM${name}`;
    const hierarchies = Array(2).fill(uri).map(makeDummyHierarchy);
    return {
      _type: "dimension",
      cube: cubeName,
      name,
      fullName: `/${cubeName}/DIM${name}`,
      dimensionType: randomValue(DimensionType),
      annotations: {},
      defaultHierarchy: randomPick(hierarchies).name,
      hierarchies,
      caption: "Dimension: " + name,
      uri,
    }
  }

  /** @return {import("..").AdaptedHierarchy} */
  function makeDummyHierarchy(parentUri) {
    const name = randomString();
    const uri = `${parentUri}/HIE${name}`;
    const parentFullName = parentUri.slice(fnIndex);
    const [, dim] = parentFullName.split("/");
    return {
      _type: "hierarchy",
      annotations: {},
      caption: "Hierarchy: " + name,
      cube: cubeName,
      dimension: dim.slice(3),
      fullName: `/${parentFullName}/HIE${name}`,
      levels: Array(4).fill(uri).map(makeDummyLevel),
      name,
      uri,
    }
  }

  /**
   * @param {string} parentUri
   * @param {number} index
   * @return {import("..").AdaptedLevel}
   */
  function makeDummyLevel(parentUri, index) {
    const name = randomString();
    const parentFullName = parentUri.slice(fnIndex);
    const [, dim, hie] = parentFullName.split("/");
    const uri = `${parentUri}/LVL${name}`;
    return {
      _type: "level",
      annotations: {},
      caption: "Level: " + name,
      cube: cubeName,
      depth: index + 1,
      dimension: dim.slice(3),
      fullName: `/${parentFullName}/LVL${name}`,
      hierarchy: hie.slice(3),
      name,
      properties: Array(4).fill(uri).map(makeDummyProperty),
      uniqueName: `LVL${name}`,
      uri,
    }
  }

  /**
   * @param {string} parentUri
   * @return {import("..").AdaptedProperty}
   */
  function makeDummyProperty(parentUri) {
    const name = randomString();
    const parentFullName = parentUri.slice(fnIndex);
    const [, dim, hie, lvl] = parentFullName.split("/");
    return {
      _type: "property",
      annotations: {},
      cube: cubeName,
      dimension: dim.slice(3),
      hierarchy: hie.slice(3),
      level: lvl.slice(3),
      name
    }
  }
}

/**
 * @param {import("..").Level} level
 * @param {number} index
 * @returns {import("..").AdaptedMember}
 */
function dummyMemberBuilder(level, index) {
  return {
    _type: "member",
    ancestors: [],
    children: [],
    key: index,
    level: level.name,
    name: WORDLIST[index],
    uri: level.toString() + "/" + index,
    caption: "",
    depth: level.depth,
    fullName: level.fullName + "/" + index,
    numChildren: 0,
    parentName: ""
  }
}

/**
 * @param {number[]} amounts
 * @returns {(q: import("..").Query, i: number) => Record<string, string | number>}
 */
function dummyDatumFactory(amounts) {
  const datumBase = {};
  return (query, index) => {
    const datum = {...datumBase};
    query.getParam("drilldowns").forEach((dd, i) => {
      datum[dd.name] = WORDLIST[index % amounts[i]];
    });
    query.getParam("measures").forEach(ms => {
      datum[ms.name] = Math.ceil(Math.random() * 2048 * ms.name.length);
    });
    // TODO: add properties
    return datum;
  };
}
