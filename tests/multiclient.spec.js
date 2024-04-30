const assert = require("node:assert");
const {
  MultiClient,
  MondrianDataSource,
  TesseractDataSource,
} = require("../dist/index.cjs");
const {randomPick, randomLevel} = require("./utils");

const {MONDRIAN_SERVER, TESSERACT_SERVER} = process.env;

describe("MultiClient", () => {
  describe(".dataSourceFromURL()", () => {
    it("should identify multiple servers", () => {
      const promise = MultiClient.dataSourcesFromURL(
        MONDRIAN_SERVER,
        TESSERACT_SERVER,
      ).then((ds) => {
        if (ds[0].serverSoftware !== MondrianDataSource.softwareName) {
          throw new Error("ds[0] not instance of MondrianDataSource");
        }
        if (ds[1].serverSoftware !== TesseractDataSource.softwareName) {
          throw new Error("ds[1] not instance of TesseractDataSource");
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
          "https://httpbin.org/status/404",
        ),
      );
    });
  });

  describe(".fromURL()", () => {
    it("should deduplicate servers", async () => {
      const client = await MultiClient.fromURL(
        MONDRIAN_SERVER,
        `${MONDRIAN_SERVER}/`,
        TESSERACT_SERVER,
        `${TESSERACT_SERVER}/`,
      );
      assert.strictEqual(typeof client, "object");
      assert.strictEqual(client.dataSourceList.length, 2);
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
    this.timeout(10000);

    it("should pick the right Cube and execute a Query correctly", async () => {
      const client = await MultiClient.fromURL(MONDRIAN_SERVER, TESSERACT_SERVER);
      const cubes = await client.getCubes();
      const cube = randomPick(cubes);

      const query = cube.query
        .addMeasure(randomPick(cube.measures).name)
        .addDrilldown(randomLevel(cube).descriptor)
        .setOption("debug", false)
        .setOption("distinct", false)
        .setOption("nonempty", true);

      const promise = client.execQuery(query);
      await assert.doesNotReject(promise);
    });
  });
});
