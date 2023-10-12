const assert = require("assert");
const {Client, TesseractDataSource, MondrianDataSource} = require("..");
const {TestDataSource} = require("./datasource");
const {randomPick, randomLevel, randomQuery} = require("./utils");

const {
  MONDRIAN_SERVER = "https://vibranium-api.datausa.io/",
  TESSERACT_SERVER = "https://oec.world/olap-proxy/",
} = process.env;

const ds = new TestDataSource();

describe("Client", function() {
  describe(".dataSourceFromURL()", function() {
    this.timeout(5000);

    it("should identify a mondrian server", async function() {
      const ds = await Client.dataSourceFromURL(MONDRIAN_SERVER);
      assert.strictEqual(ds.constructor.name, MondrianDataSource.name);
    });

    it("should identify a tesseract server", async function() {
      const ds = await Client.dataSourceFromURL(TESSERACT_SERVER);
      assert.strictEqual(ds.constructor.name, TesseractDataSource.name);
    });

    it("should reject on invalid servers", function() {
      assert.rejects(Client.dataSourceFromURL("https://httpbin.org/html"));
      assert.rejects(Client.dataSourceFromURL("https://httpbin.org/status/404"));
    });
  });

  describe("#constructor()", function() {
    it("should construct an empty client instance if no parameters passed", function() {
      assert.doesNotThrow(function() {
        const client = new Client();
      });
    });

    it("should throw if requesting against a client without datasource", function() {
      assert.throws(function() {
        const client = new Client();
        client.getCubes();
      });
    });

    it("should allow to add new datasources later", function() {
      assert.doesNotThrow(function() {
        const client = new Client();
        client.setDataSource(ds);
      });
    });

    it("should throw if requesting anything without setting datasource", function() {
      assert.throws(function() {
        const client = new Client();
        client.checkStatus();
      });
    });
  });

  describe("#execQuery()", function() {
    it("should execute a Query correctly", async function() {
      const client = new Client(ds);
      const cubes = await client.getCubes();
      const cube = randomPick(cubes);

      const measure = randomPick(cube.measures);
      const level = randomLevel(cube);
      const query = cube.query
        .addMeasure(measure)
        .addDrilldown(level.name)
        .setOption("debug", false)
        .setOption("distinct", false)
        .setOption("nonempty", true);

      const promise = client.execQuery(query);
      await assert.doesNotReject(promise);
    });
  });

  describe("#getMembers()", function() {
    it("should retrieve the list of members for a level", async function() {
      const client = new Client(ds);
      const cubes = await client.getCubes();
      const cube = randomPick(cubes);
      const level = randomPick(randomPick(randomPick(cube.dimensions).hierarchies).levels);

      const promise = client.getMembers(level);
      await assert.doesNotReject(promise);
    });
  });

  describe("#parseQueryURL()", function() {
    it("should parse an url into a query", async function() {
      const client = new Client(ds);

      const cubes = await client.getCubes();
      const cube = randomPick(cubes);

      const queryExpected = randomQuery(cube);
      const urlExpected = queryExpected.toString("");

      const queryActual = await client.parseQueryURL(urlExpected);
      const urlActual = queryActual.toString("");

      assert.strictEqual(urlActual, urlExpected);
    })
  })
});
