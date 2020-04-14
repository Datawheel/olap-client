const assert = require("assert");
const { Client, MondrianDataSource } = require("../dist/index.cjs");

const {
  MONDRIAN_SERVER = "https://chilecube.datachile.io/",
  TESSERACT_SERVER = "https://api.oec.world/tesseract/"
} = process.env;

describe("Client", () => {
  describe(".dataSourceFromURL()", () => {
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
        const datasource = new MondrianDataSource(MONDRIAN_SERVER);
        client.setDataSource(datasource);
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
    this.timeout(5000);

    it("should execute a Query correctly", async () => {
      const client = await Client.fromURL("https://chilecube.datachile.io");
      const cube = await client.getCube("tax_data");
      const query = cube.query
        .addMeasure("Labour")
        .addDrilldown("Year")
        .setOption("debug", false)
        .setOption("distinct", false)
        .setOption("nonempty", true);

      const promise = client.execQuery(query);
      await assert.doesNotReject(promise);
    });
  });

  describe("#parseQueryURL()", function() {
    it("should parse an url into a query", () => {
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
