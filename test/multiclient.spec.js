const assert = require("assert");
const { MultiClient, MondrianDataSource } = require("..");
const { randomPick, randomLevel } = require("./utils");

const {
  MONDRIAN_SERVER = "https://vibranium-api.datausa.io/",
  MONDRIAN_CUBENAME = "health_medicaid_spending_per_enrolle",
  TESSERACT_SERVER = "https://oec.world/olap-proxy/",
} = process.env;

describe("MultiClient", function() {
  describe(".dataSourceFromURL()", function() {
    it("should identify multiple servers", function() {
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

    it("should reject on invalid servers", function() {
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

  describe(".fromURL()", function() {
    it("should deduplicate servers", async function() {
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

  describe("#constructor()", function() {
    it("should construct an empty client instance if no parameters passed", function() {
      assert.doesNotThrow(function() {
        const client = new MultiClient();
      });
    });

    it("should throw if requesting against a client without datasource", function() {
      assert.throws(function() {
        const client = new MultiClient();
        client.getCubes();
      });
    });

    it("should allow to add new datasources later", function() {
      assert.doesNotThrow(function() {
        const client = new MultiClient();
        const datasource = new MondrianDataSource(MONDRIAN_SERVER);
        client.addDataSource(datasource);
      });
    });

    it("should throw if requesting anything without setting datasource", function() {
      assert.throws(function() {
        const client = new MultiClient();
        return client.checkStatus();
      });
    });
  });

  describe("#execQuery()", function () {
    this.timeout(10000);

    it("should pick the right Cube and execute a Query correctly", async function() {
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
