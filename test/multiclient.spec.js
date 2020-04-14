const assert = require("assert");
const { MultiClient, MondrianDataSource } = require("../dist/index.cjs");

const {
  MONDRIAN_SERVER = "https://chilecube.datachile.io",
  TESSERACT_SERVER = "https://api.oec.world/tesseract"
} = process.env;

describe("MultiClient", () => {
  describe(".dataSourceFromURL()", () => {
    it("should identify multiple servers", () => {
      const promise = MultiClient.dataSourcesFromURL(
        MONDRIAN_SERVER,
        TESSERACT_SERVER
      ).then(ds => {
        if (ds[0].constructor.name !== "MondrianDataSource") {
          throw new Error("ds[0].constructor.name !== MondrianDataSource");
        }
        if (ds[1].constructor.name !== "TesseractDataSource") {
          throw new Error("ds[1].constructor.name !== TesseractDataSource");
        }
      });
      assert.doesNotReject(promise);
    });

    it("should reject on invalid servers", () => {
      assert.rejects(MultiClient.dataSourcesFromURL("https://httpbin.org/html"));
      assert.rejects(MultiClient.dataSourcesFromURL("https://httpbin.org/status/404"));
      assert.rejects(
        MultiClient.dataSourcesFromURL(
          "https://httpbin.org/html",
          "https://httpbin.org/status/404"
        )
      );
    });
  });

  describe(".fromURL()", () => {
    it("should deduplicate servers", async () => {
      /** @type {import("../src").MultiClient} */
      const client = await MultiClient.fromURL(
        MONDRIAN_SERVER,
        `${MONDRIAN_SERVER}/`,
        TESSERACT_SERVER,
        `${TESSERACT_SERVER}/`
      );
      assert.equal(typeof client, "object");
      assert.equal(Object.keys(client.datasources).length, 2);
    });
  });

  describe("#constructor()", () => {
    it("should construct an empty client instance if no parameters passed", () => {
      assert.doesNotThrow(() => {
        const client = new MultiClient();
      });
    });

    it("should throw if requesting against a client without datasource", () => {
      assert.throws(() => {
        const client = new MultiClient();
        client.getCubes();
      });
    });

    it("should allow to add new datasources later", () => {
      assert.doesNotThrow(() => {
        const client = new MultiClient();
        const datasource = new MondrianDataSource(MONDRIAN_SERVER);
        client.addDataSource(datasource);
      });
    });

    it("should throw if requesting anything without setting datasource", () => {
      assert.throws(() => {
        const client = new MultiClient();
        return client.checkStatus();
      });
    });
  });

  describe("#execQuery()", function () {
    this.timeout(5000);

    it("should pick the right Cube and execute a Query correctly", async () => {
      const client = await MultiClient.fromURL(
        MONDRIAN_SERVER,
        TESSERACT_SERVER
      );
      const cube = await client.getCube("tax_data");
      assert.equal(cube.server, "https://chilecube.datachile.io/");

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
});
