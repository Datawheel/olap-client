const assert = require("assert");
const {TesseractDataSource, Cube} = require("..");

const {
  TESSERACT_SERVER = "https://oec.world/olap-proxy/",
} = process.env;

describe("TesseractDataSource", function() {
  this.timeout(5000);
  describe(".queryAggregate()", function() {});
  describe(".queryLogicLayer()", function() {});
  describe(".urlAggregate()", function() {});
  describe(".urlLogicLayer()", function() {});

  describe("#constructor()", function() {
    it("should create a new instance from a string", function() {
      assert.doesNotThrow(() => {
        new TesseractDataSource("/tesseract");
      });
    });

    it("should throw if nothing is passed", function() {
      assert.throws(() => {
        new TesseractDataSource();
      });
    });

    it("should throw if something besides a string is passed", function() {
      assert.throws(() => {
        new TesseractDataSource({url: "/tesseract"});
      });
      assert.throws(() => {
        new TesseractDataSource(null);
      });
    });

    it("should store the passed URL in #serverURL and in axiosInstance", function() {
      const ds = new TesseractDataSource("http://testserver:8080/olap");
      assert.strictEqual(ds.serverUrl, "http://testserver:8080/olap/");
      assert.strictEqual(ds.axiosInstance.defaults.baseURL, "http://testserver:8080/olap/");
    });
  });

  describe("#checkStatus()", function() {
    const ds = new TesseractDataSource(TESSERACT_SERVER);

    it("should not reject", async function() {
      const promise = ds.checkStatus();
      await assert.doesNotReject(promise);
    });

    it("should return the server status", async function() {
      const status = await ds.checkStatus();
      assert.ok(status.online);
      assert.strictEqual(status.software, ds.constructor.softwareName);
      assert.strictEqual(status.url, TESSERACT_SERVER);
      assert.match(status.version, /^\d+\.\d+\.\d+$/);
    });
  });

  describe("#execQuery()", function() {
    const ds = new TesseractDataSource(TESSERACT_SERVER);
    let query;

    this.beforeAll(async function() {
      const pcube = await ds.fetchCube("indicators_i_wdi_a")
      const cube = new Cube(pcube, ds);
      query = cube.query
        .addDrilldown("Country")
        .addMeasure("Measure")
        .addCut("Continent", ["eu"])
        .setFormat("jsonrecords");
    });

    it("should query the server through the Aggregate endpoint", async function() {
      const res = await ds.execQuery(query, "aggregate");
      assert.match(res.url, /\/cubes\/indicators_i_wdi_a\/aggregate\.jsonrecords\?/);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.length, 48);
    });

    it("should query the server through the LogicLayer endpoint", async function() {
      const res = await ds.execQuery(query, "logiclayer");
      assert.match(res.url, /\/data\.jsonrecords\?/);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.length, 48);
    });
  });

  describe("#fetchCubes()", function() {
    const ds = new TesseractDataSource(TESSERACT_SERVER);

    it("should get a list of cubes from the server", async function() {
      const cubes = await ds.fetchCubes();
      assert.ok(cubes.length > 0);
    });
  });

  describe("#fetchCube()", function() {
    const ds = new TesseractDataSource(TESSERACT_SERVER);

    it("should get a specific cube from the server", async function() {
      const cube = await ds.fetchCube("indicators_i_wdi_a");
      assert.strictEqual(cube.name, "indicators_i_wdi_a");
    });
  });

  describe("#fetchMembers()", function() {
    const ds = new TesseractDataSource(TESSERACT_SERVER);

    it("should get a list of members for a cube level", async function() {
      const level = {cube:{name: "indicators_i_wdi_a"}, name: "Year"};
      const members = await ds.fetchMembers(level);
      assert.ok(members.length > 0);
    });
  });

  describe("#fetchMember()", function() {
    const ds = new TesseractDataSource(TESSERACT_SERVER);

    it("should get a single member for a cube level", async function() {
      const level = {cube:{name: "indicators_i_wdi_a"}, name: "Year"};
      const member = await ds.fetchMember(level, 2000);
      assert.strictEqual(member.key, 2000)
    });
  });

  describe("#parseQueryURL()", function() {});

  describe("#setRequestConfig()", function() {
    const ds = new TesseractDataSource("https://httpbin.org/");

    it("should add extra parameters to any request", async function() {
      const value = Math.random().toString(16).slice(2);
      ds.setRequestConfig({
        headers: {"X-Custom-Header": value},
        params: {"cube-name": value}
      });
      const {data, status} = await ds.axiosInstance.get("anything");
      assert.strictEqual(status, 200);
      assert.strictEqual(data.headers["X-Custom-Header"], value);
      assert.strictEqual(data.args["cube-name"], value);
    });
  });

  describe("#stringifyQueryURL()", function() {});
});
