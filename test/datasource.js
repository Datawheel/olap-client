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
  "xray",
  "yankee",
  "zulu",
];

/**
 * @typedef {import("..").IDataSource} IDataSource
 */

/**
 * @implements {IDataSource}
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

  fetchCube(cubeName) {
    return new Promise((resolve, reject) => {
      const index = CUBE_NAMES.indexOf(cubeName);
      if (index < this.cubes.length) resolve(this.cubes[index]);
      else reject(new Error(`Cube name ${cubeName} is invalid`));
    });
  }

  fetchCubes() {
    return new Promise((resolve) => {
      resolve(Object.values(this.cubes));
    });
  }

  fetchMember(parent, key, options) {
    return new Promise(resolve => {
      const member = dummyMemberBuilder(parent, key % 255);
      resolve(member);
    });
  }

  fetchMembers(parent, options) {
    return new Promise(resolve => {
      const {name} = parent;
      const total = name.split("").reduce((prod, ch) => ch.charCodeAt(0) * prod, 1);
      const members = Array(total % 255).fill(parent).map(dummyMemberBuilder);
      resolve(members);
    });
  }

  parseQueryURL(query, url, options) {
    const [server, search] = url.split("/query?");
    if (query.cube.server === server) {
      const params = formUrlDecoded(search);
      query.fromJSON(params);
      return query;
    }
    throw new Error(`URL ${server} doesn't match server URL in Query object provided.`);
  }

  setRequestConfig({ url, baseUrl, ...config }) {
    this.config = {
      ...this.config,
      config,
    };
  }

  stringifyQueryURL(query) {
    return `${this.serverUrl}/query?${formUrlEncoded(query.toJSON(), {
      ignorenull: true,
      skipIndex: false,
      sorted: true,
    })}`;
  }
}

module.exports = {
  TestDataSource,
};
