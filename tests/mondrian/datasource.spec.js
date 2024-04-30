const assert = require("node:assert");
const {MondrianDataSource, Cube} = require("../../dist/index.cjs");

const {MONDRIAN_SERVER} = process.env;

describe("MondrianDataSource", function () {
  this.timeout(10000);

  describe("#constructor()", () => {
    it("should create a new instance from a string", () => {
      assert.doesNotThrow(() => {
        new MondrianDataSource("/mondrian/");
      });
    });

    it("should throw if nothing is passed", () => {
      assert.throws(() => {
        new MondrianDataSource();
      });
    });

    it("should throw if something besides a string is passed", () => {
      assert.throws(() => {
        new MondrianDataSource({url: "/mondrian-rest"});
      });
      assert.throws(() => {
        new MondrianDataSource(null);
      });
    });

    it("should store the passed URL in #serverURL and in axiosInstance", () => {
      const expected = "http://testserver:8080/olap/";
      const ds = new MondrianDataSource("http://testserver:8080/olap");
      assert.strictEqual(ds.serverUrl, expected);
      assert.strictEqual(ds.axiosInstance.defaults.baseURL, expected);
    });
  });

  describe("#checkStatus", () => {
    const ds = new MondrianDataSource(MONDRIAN_SERVER);

    it("should not reject", async () => {
      const promise = ds.checkStatus();
      await assert.doesNotReject(promise);
    });

    it("should return the server status", async () => {
      const status = await ds.checkStatus();
      assert.ok(status.online);
      assert.strictEqual(status.software, MondrianDataSource.softwareName);
      assert.strictEqual(status.url, MONDRIAN_SERVER);
      assert.match(status.version, /^\d+\.\d+\.\d+$/);
    });
  });

  describe("#execQuery", function () {
    const ds = new MondrianDataSource(MONDRIAN_SERVER);
    let query;

    this.beforeAll(async () => {
      query = await ds.fetchCube("dot_faf").then((plainCube) => {
        const cube = new Cube(plainCube, ds);
        return cube.query
          .addDrilldown("[Destination].[Destination State]")
          .addMeasure("Millions Of Dollars")
          .addCut("Year", ["2020"])
          .setFormat("jsonrecords");
      });
    });

    it("should query the server", async () => {
      const res = await ds.execQuery(query);

      assert.match(res.url, /\/cubes\/dot_faf\/aggregate\.jsonrecords\?/);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.length, 51);
    });
  });

  describe("#fetchCubes", () => {
    const ds = new MondrianDataSource(MONDRIAN_SERVER);

    it("should get a list of cubes from the server", async () => {
      const cubes = await ds.fetchCubes();
      assert.ok(cubes.length > 0);
      assert.ok(cubes.some((cube) => cube.name === "dot_faf"));
    });
  });

  describe("#fetchCube", () => {
    const ds = new MondrianDataSource(MONDRIAN_SERVER);

    it("should get a specific cube from the server", async () => {
      const cube = await ds.fetchCube("dot_faf");
      assert.strictEqual(cube.name, "dot_faf");
    });
  });

  describe("#fetchMembers", function () {
    const ds = new MondrianDataSource(MONDRIAN_SERVER);
    let level;

    this.beforeAll(async () => {
      level = await ds.fetchCube("dot_faf").then((plainCube) => {
        const cube = new Cube(plainCube, ds);
        return cube.getLevel("Year");
      });
    });

    it("should get a list of members for a cube level", async () => {
      const members = await ds.fetchMembers(level);
      assert.ok(members.length > 15);
      assert.ok(members.map((member) => member.key).includes(2015));
    });
  });

  describe("#fetchMember", function () {
    const ds = new MondrianDataSource(MONDRIAN_SERVER);
    let level;

    this.beforeAll(async () => {
      level = await ds.fetchCube("dot_faf").then((plainCube) => {
        const cube = new Cube(plainCube, ds);
        return cube.getLevel("Year");
      });
    });

    it("should get a single member for a cube level", async () => {
      const member = await ds.fetchMember(level, 2015);
      assert.strictEqual(member.key, 2015);
    });

    it("should throw a clear error if the member does not exist", async () => {
      const promise = ds.fetchMember(level, 1960);
      assert.rejects(promise, {
        name: "Error",
        message: "Can't find member with key '1960' for level 'Year'",
      });
    });
  });

  describe("#setRequestConfig", () => {
    const ds = new MondrianDataSource("https://httpbin.org/");

    it("should add extra parameters to any request", async () => {
      const value = Math.random().toString(16).slice(2);

      ds.setRequestConfig({
        headers: {"X-Custom-Header": value},
        params: {"cube-name": value},
      });

      const {data, status} = await ds.axiosInstance.get("anything");

      assert.strictEqual(status, 200);
      assert.strictEqual(data.headers["X-Custom-Header"], value);
      assert.strictEqual(data.args["cube-name"], value);
    });
  });

  describe("#parseQueryURL", () => {});

  describe("#stringifyQueryURL", () => {});
});
