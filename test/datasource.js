// @ts-check

const {default: formUrlEncoded} = require("form-urlencoded");
const formUrlDecoded = require("form-urldecoded");
const { dummyCubeBuilder, dummyMemberBuilder, dummyDatumFactory } = require("./dummy");

const CUBE_NAMES = [
  "alfa",
  "bravo",
  "charlie",
  "delta",
  "echo",
  "foxtrot",
  "golf",
  "hotel",
  "india",
  "juliett",
  "kilo",
  "lima",
  "mike",
  "november",
  "oscar",
  "papa",
  "quebec",
  "romeo",
  "sierra",
  "tango",
  "uniform",
  "victor",
  "whiskey",
  "x-ray",
  "yankee",
  "zulu",
];

/**
 * @implements {import("..").IDataSource}
 */
class TestDataSource {
  cubes = CUBE_NAMES.map(dummyCubeBuilder);

  serverOnline = true;
  serverSoftware = "test";
  serverUrl = "test://dummyolap";
  serverVersion = "0.0";

  checkStatus() {
    return Promise.resolve({
      online: this.serverOnline,
      software: this.serverSoftware,
      url: this.serverUrl,
      version: this.serverVersion,
    });
  }

  /** @returns {Promise<import("..").Aggregation>} */
  execQuery(query) {
    return new Promise(resolve => {
      const amounts = query.getParam("drilldowns").map(dd => {
        const total = dd.name.split("").reduce((prod, ch) => ch.charCodeAt(0) * prod, 1);
        return total % 255
      });
      const dummyDatumBuilder = dummyDatumFactory(amounts);
      const total = amounts.reduce((prod, i) => prod * i, 1);
      resolve({
        data: Array(total).fill(query).map(dummyDatumBuilder),
        query,
        headers: {
          "Content-Type": "application/json",
        },
        status: 200,
        url: this.stringifyQueryURL(query),
      });
    });
  }

  /** @returns {Promise<import("..").AdaptedCube>} */
  fetchCube(cubeName) {
    return new Promise((resolve, reject) => {
      const index = CUBE_NAMES.indexOf(cubeName);
      if (index < this.cubes.length) resolve(this.cubes[index]);
      else reject(new Error(`Cube name ${cubeName} is invalid`));
    });
  }

  /** @returns {Promise<import("..").AdaptedCube[]>} */
  fetchCubes() {
    return new Promise((resolve) => {
      resolve(Object.values(this.cubes));
    });
  }

  /** @returns {Promise<import("..").AdaptedMember>} */
  fetchMember(parent, key, options) {
    return new Promise(resolve => {
      const member = dummyMemberBuilder(parent, key % 255);
      resolve(member);
    });
  }

  /** @returns {Promise<import("..").AdaptedMember[]>} */
  fetchMembers(parent, options) {
    return new Promise(resolve => {
      const {name} = parent;
      const total = name.split("").reduce((prod, ch) => ch.charCodeAt(0) * prod, 1);
      const members = Array(total % 255).fill(parent).map(dummyMemberBuilder);
      resolve(members);
    });
  }

  /** @returns {import("..").Query} */
  parseQueryURL(query, url, options) {
    const [server, search] = url.split("/query?");
    if (query.cube.server === server) {
      const params = formUrlDecoded(search);
      return query;
    }
    throw new Error(`URL ${server} doesn't match server URL in Query object provided.`);
  }

  /** @returns {void} */
  setRequestConfig({ url, baseUrl, ...config }) {
    this.config = {
      ...this.config,
      config,
    };
  }

  /** @returns {string} */
  stringifyQueryURL(query) {
    return `${this.serverUrl}/query?${formUrlEncoded(query.toJSON(), {
      ignorenull: true,
      skipIndex: true,
      sorted: true,
    })}`;
  }
}

module.exports = {
  TestDataSource,
};
