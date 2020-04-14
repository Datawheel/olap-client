const assert = require("assert");
const {Client, TesseractDataSource} = require("..");
const {randomPick} = require("./utils");
const {TestDataSource} = require("./datasource");

const {
  MONDRIAN_SERVER = "https://chilecube.datachile.io/",
  TESSERACT_SERVER = "https://api.oec.world/tesseract/"
} = process.env;

const ds = new TestDataSource();

describe("Client", function() {
  describe(".dataSourceFromURL()", function() {
    this.timeout(5000);

    it("should identify a mondrian server", async () => {
      const ds = await Client.dataSourceFromURL(MONDRIAN_SERVER);
      assert.equal(ds.constructor.name, "MondrianDataSource");
    });

    it("should identify a tesseract server", async () => {
      const ds = await Client.dataSourceFromURL(TESSERACT_SERVER);
      assert.equal(ds.constructor.name, "TesseractDataSource");
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

  describe("#execQuery()", function() {
    it("should execute a Query correctly", async () => {
      const client = new Client(ds);
      const cubes = await client.getCubes();
      const cube = randomPick(cubes);

      const measure = randomPick(cube.measures);
      const level = randomPick(randomPick(randomPick(cube.dimensions).hierarchies).levels);
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
    it("should retrieve the list of members for a level", async () => {
      const client = new Client(ds);
      const cubes = await client.getCubes();
      const cube = randomPick(cubes);
      const level = randomPick(randomPick(randomPick(cube.dimensions).hierarchies).levels);

      const promise = client.getMembers(level);
      await assert.doesNotReject(promise);
    });
  });

  describe("#parseQueryURL()", function() {
    it("should parse an url into a query", async () => {
      const ds = new TesseractDataSource("https://api.oec.world/tesseract/");
      const client = new Client(ds);

      const url2 = "https://api.oec.world/tesseract/data.jsonrecords?HS4=10101&cube=trade_i_baci_a_02&drilldowns=Year&measures=Trade+Value";
      const query = await client.parseQueryURL(url2);

      const generatedUrl =
        url.indexOf("/aggregate") > -1
        ? query.toString("aggregate")
        : query.toString("logiclayer");

      assert.equal(generatedUrl, url);
    })
  })
});
