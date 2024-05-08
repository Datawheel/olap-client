const assert = require("node:assert");
const {
  Client,
  TesseractDataSource,
  MondrianDataSource,
  PyTesseractDataSource,
} = require("../dist/index.cjs");
const {TestDataSource} = require("./datasource");
const {randomPick, randomLevel, randomQuery} = require("./utils");

// Ensure online test runs before
require("./online.spec");

const {MONDRIAN_SERVER, TESSERACT_SERVER, PYTESSERACT_SERVER} = process.env;

const ds = new TestDataSource();

describe("Client", () => {
  describe(".dataSourceFromURL()", function () {
    this.timeout(5000);

    it("should identify a mondrian server", async () => {
      const ds = await Client.dataSourceFromURL(MONDRIAN_SERVER);
      assert.strictEqual(ds.serverSoftware, MondrianDataSource.softwareName);
    });

    it("should identify a tesseract server", async () => {
      const ds = await Client.dataSourceFromURL(TESSERACT_SERVER);
      assert.strictEqual(ds.serverSoftware, TesseractDataSource.softwareName);
    });

    it("should identify a pytesseract server", async () => {
      const ds = await Client.dataSourceFromURL(PYTESSERACT_SERVER);
      assert.strictEqual(ds.serverSoftware, PyTesseractDataSource.softwareName);
    });

    it("should reject on invalid servers", () => {
      assert.rejects(Client.dataSourceFromURL("https://httpbin.org/html"));
      assert.rejects(Client.dataSourceFromURL("https://httpbin.org/status/404"));
    });
  });

  describe("#constructor()", () => {
    it("should construct an empty client instance if no parameters passed", () => {
      assert.doesNotThrow(() => {
        const client = new Client();
      });
    });

    it("should throw if requesting against a client without datasource", () => {
      assert.throws(() => {
        const client = new Client();
        client.getCubes();
      });
    });

    it("should allow to add new datasources later", () => {
      assert.doesNotThrow(() => {
        const client = new Client();
        client.setDataSource(ds);
      });
    });

    it("should throw if requesting anything without setting datasource", () => {
      assert.throws(() => {
        const client = new Client();
        client.checkStatus();
      });
    });
  });

  describe("#execQuery()", () => {
    it("should execute a Query correctly", async () => {
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

  describe("#getMembers()", () => {
    it("should retrieve the list of members for a level", async () => {
      const client = new Client(ds);
      const cubes = await client.getCubes();
      const cube = randomPick(cubes);
      const level = randomPick(
        randomPick(randomPick(cube.dimensions).hierarchies).levels,
      );

      const promise = client.getMembers(level);
      await assert.doesNotReject(promise);
    });
  });

  describe("#parseQueryURL()", () => {
    it("should parse an url into a query", async () => {
      const client = new Client(ds);

      const cubes = await client.getCubes();
      const cube = randomPick(cubes);

      const queryExpected = randomQuery(cube);
      const urlExpected = queryExpected.toString("");

      const queryActual = await client.parseQueryURL(urlExpected);
      const urlActual = queryActual.toString("");

      assert.strictEqual(urlActual, urlExpected);
    });
  });
});
