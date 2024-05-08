const assert = require("node:assert");
const {TesseractDataSource, Cube} = require("../../dist/index.cjs");

// Ensure online test runs before
require("../online.spec");

const {TESSERACT_SERVER} = process.env;

describe("TesseractDataSource", function () {
  this.timeout(5000);
  describe(".queryAggregate()", () => {});
  describe(".queryLogicLayer()", () => {});
  describe(".urlAggregate()", () => {});
  describe(".urlLogicLayer()", () => {});

  describe("#constructor()", () => {
    it("should create a new instance from a string", () => {
      assert.doesNotThrow(() => {
        new TesseractDataSource("/tesseract");
      });
    });

    it("should throw if nothing is passed", () => {
      assert.throws(() => {
        new TesseractDataSource();
      });
    });

    it("should throw if something besides a string is passed", () => {
      assert.throws(() => {
        new TesseractDataSource({url: "/tesseract"});
      });
      assert.throws(() => {
        new TesseractDataSource(null);
      });
    });

    it("should store the passed URL in #serverURL and in axiosInstance", () => {
      const ds = new TesseractDataSource("http://testserver:8080/olap");
      assert.strictEqual(ds.serverUrl, "http://testserver:8080/olap/");
      assert.strictEqual(
        ds.axiosInstance.defaults.baseURL,
        "http://testserver:8080/olap/",
      );
    });
  });

  describe("#checkStatus()", () => {
    const ds = new TesseractDataSource(TESSERACT_SERVER);

    it("should not reject", async () => {
      const promise = ds.checkStatus();
      await assert.doesNotReject(promise);
    });

    it("should return the server status", async () => {
      const status = await ds.checkStatus();
      assert.ok(status.online);
      assert.strictEqual(status.software, TesseractDataSource.softwareName);
      assert.strictEqual(status.url, TESSERACT_SERVER);
      assert.match(status.version, /^\d+\.\d+\.\d+$/);
    });
  });

  describe("#execQuery()", function () {
    const ds = new TesseractDataSource(TESSERACT_SERVER);
    let query;

    this.beforeAll(async () => {
      query = await ds.fetchCube("indicators_i_wdi_a").then((plainCube) => {
        const cube = new Cube(plainCube, ds);
        return cube.query
          .addDrilldown("Country")
          .addMeasure("Measure")
          .addCut("Continent", ["eu"])
          .setFormat("jsonrecords");
      });
    });

    it("should query the server through the Aggregate endpoint", async () => {
      const res = await ds.execQuery(query, "aggregate");
      assert.match(res.url, /\/cubes\/indicators_i_wdi_a\/aggregate\.jsonrecords\?/);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.length, 48);
    });

    it("should query the server through the LogicLayer endpoint", async () => {
      const res = await ds.execQuery(query, "logiclayer");
      assert.match(res.url, /\/data\.jsonrecords\?/);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.length, 48);
    });
  });

  describe("#fetchCubes()", () => {
    const ds = new TesseractDataSource(TESSERACT_SERVER);

    it("should get a list of cubes from the server", async () => {
      const cubes = await ds.fetchCubes();
      assert.ok(cubes.length > 0);
    });
  });

  describe("#fetchCube()", () => {
    const ds = new TesseractDataSource(TESSERACT_SERVER);

    it("should get a specific cube from the server", async () => {
      const cube = await ds.fetchCube("indicators_i_wdi_a");
      assert.strictEqual(cube.name, "indicators_i_wdi_a");
    });
  });

  describe("#fetchMembers()", () => {
    const ds = new TesseractDataSource(TESSERACT_SERVER);
    let level;

    this.beforeAll(async () => {
      level = await ds.fetchCube("indicators_i_wdi_a").then((plainCube) => {
        const cube = new Cube(plainCube, ds);
        return cube.getLevel("Year");
      });
    });

    it("should get a list of members for a cube level", async () => {
      const members = await ds.fetchMembers(level);
      assert.ok(members.length > 60);
      assert.ok(members.map((member) => member.key).includes(2000));
    });
  });

  describe("#fetchMember()", () => {
    const ds = new TesseractDataSource(TESSERACT_SERVER);
    let level;

    this.beforeAll(async () => {
      level = await ds.fetchCube("indicators_i_wdi_a").then((plainCube) => {
        const cube = new Cube(plainCube, ds);
        return cube.getLevel("Year");
      });
    });

    it("should get a single member for a cube level", async () => {
      const member = await ds.fetchMember(level, 2000);
      assert.strictEqual(member.key, 2000);
    });

    it("should throw a clear error if the member does not exist", async () => {
      const promise = ds.fetchMember(level, 1900);
      assert.rejects(promise, {
        name: "Error",
        message: "Can't find member with key '1900' for level 'Year'",
      });
    });
  });

  describe("#setRequestConfig()", () => {
    const ds = new TesseractDataSource("https://httpbin.org/");

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

  describe("#parseQueryURL()", () => {});

  describe("#stringifyQueryURL()", () => {});
});
