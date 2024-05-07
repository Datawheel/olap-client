const assert = require("node:assert");
const {PyTesseractDataSource, Cube} = require("../../dist/index.cjs");

const {PYTESSERACT_SERVER} = process.env;

describe("PyTesseractDataSource", function () {
  this.timeout(5000);

  describe("#constructor()", () => {
    it("should create a new instance from a string", () => {
      assert.doesNotThrow(() => {
        new PyTesseractDataSource("/tesseract");
      });
    });

    it("should throw if nothing is passed", () => {
      assert.throws(() => {
        new PyTesseractDataSource();
      });
    });

    it("should throw if something besides a string is passed", () => {
      assert.throws(() => {
        new PyTesseractDataSource({url: "/tesseract"});
      });
      assert.throws(() => {
        new PyTesseractDataSource(null);
      });
    });

    it("should store the passed URL in #serverURL and in axiosInstance", () => {
      const expected = "http://testserver:8080/olap/";
      const ds = new PyTesseractDataSource("http://testserver:8080/olap");
      assert.strictEqual(ds.serverUrl, expected);
      assert.strictEqual(ds.axiosInstance.defaults.baseURL, expected);
    });
  });

  describe("#checkStatus", () => {
    const ds = new PyTesseractDataSource(PYTESSERACT_SERVER);

    it("should not reject", async () => {
      const promise = ds.checkStatus();
      await assert.doesNotReject(promise);
    });

    it("should return the server status", async () => {
      const status = await ds.checkStatus();
      assert.ok(status.online);
      assert.strictEqual(status.software, PyTesseractDataSource.softwareName);
      assert.strictEqual(status.url, PYTESSERACT_SERVER);
      assert.match(status.version, /^\d+\.\d+\.\d+$/);
    });
  });

  describe("#execQuery", function () {
    const ds = new PyTesseractDataSource(PYTESSERACT_SERVER);
    let query;

    this.beforeAll(async () => {
      query = await ds.fetchCube("indicators_i_wdi_a").then((plainCube) => {
        const cube = new Cube(plainCube, ds);
        return cube.query
          .setLocale("en")
          .addMeasure("Measure")
          .addDrilldown("Year")
          .addDrilldown("Country")
          .addCut("Continent", ["na"])
          .setFormat("jsonrecords");
      });
    });

    it("should query the server", async () => {
      const res = await ds.execQuery(query);

      assert.match(res.url, /\/data\.jsonrecords\?/);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.length, 2205);

      const columns = Object.keys(res.data[0]);
      assert.ok(columns.includes("Year"));
      assert.ok(columns.includes("Country"));
      assert.ok(columns.includes("Country ID"));
      assert.ok(columns.includes("Measure"));
    });
  });

  describe("#fetchCubes", () => {
    const ds = new PyTesseractDataSource(PYTESSERACT_SERVER);

    it("should get a list of cubes from the server", async () => {
      const cubes = await ds.fetchCubes();
      assert.ok(cubes.length > 0);
      assert.ok(cubes.some((cube) => cube.name === "indicators_i_wdi_a"));
    });
  });

  describe("#fetchCube", () => {
    const ds = new PyTesseractDataSource(PYTESSERACT_SERVER);

    it("should get a specific cube from the server", async () => {
      const cube = await ds.fetchCube("indicators_i_wdi_a");
      assert.strictEqual(cube.name, "indicators_i_wdi_a");
    });
  });

  describe("#fetchMembers", function () {
    const ds = new PyTesseractDataSource(PYTESSERACT_SERVER);
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

  describe("#fetchMember", function () {
    const ds = new PyTesseractDataSource(PYTESSERACT_SERVER);
    let level;

    this.beforeAll(async () => {
      level = await ds.fetchCube("indicators_i_wdi_a").then((plainCube) => {
        const cube = new Cube(plainCube, ds);
        return cube.getLevel("Year");
      });
    });

    it("should get a single member for a cube level", async () => {
      const member = await ds.fetchMember(level, 1960);
      assert.strictEqual(member.key, 1960);
    });

    it("should throw a clear error if the member does not exist", async () => {
      const promise = ds.fetchMember(level, 1900);
      assert.rejects(promise, {
        name: "Error",
        message: "Can't find member with key '1900' for level 'Year'",
      });
    });
  });

  describe("#setRequestConfig", () => {
    const ds = new PyTesseractDataSource("https://httpbin.org/");

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

  describe("#parseQueryURL", () => {
    const ds = new PyTesseractDataSource(PYTESSERACT_SERVER);
    const search = new URLSearchParams([
      ["cube", "indicators_i_wdi_a"],
      ["locale", "es"],
      ["drilldowns", "Year,Country"],
      ["measures", "Measure"],
      ["properties", "ISO 3"],
      ["include", "Year:2020,2021"],
      ["exclude", "Continent:af,as"],
      ["filters", "Measure.lte.100000"],
      ["limit", "1,2"],
      ["sort", "ISO 3.asc"],
      ["time", "year.latest"],
      ["parents", "false"],
    ]);
    let cube;

    this.beforeAll(async () => {
      cube = await ds.fetchCube("indicators_i_wdi_a").then((cube) => new Cube(cube, ds));
    });

    it("should parse a search string into a Query", () => {
      let query;

      assert.doesNotThrow(() => {
        query = ds.parseQueryURL(cube.query, `http://testserver/?${search}`);
      });

      assert.strictEqual(query.cube.name, "indicators_i_wdi_a");
      assert.strictEqual(query.getParam("locale"), "es");
      assert.deepEqual(query.getParam("drilldowns"), [
        cube.getLevel("Year"),
        cube.getLevel("Country"),
      ]);
      assert.deepEqual(query.getParam("measures"), [cube.getMeasure("Measure")]);
      assert.deepEqual(query.getParam("properties"), [cube.getProperty("ISO 3")]);
      assert.deepEqual(query.getParam("cuts"), [
        {
          drillable: cube.getLevel("Year"),
          members: ["2020", "2021"],
          isExclusive: false,
          isForMatch: undefined,
        },
        {
          drillable: cube.getLevel("Continent"),
          members: ["af", "as"],
          isExclusive: true,
          isForMatch: undefined,
        },
      ]);
      assert.deepEqual(query.getParam("filters"), [
        {
          measure: cube.getMeasure("Measure"),
          const1: ["lte", 100000],
          joint: undefined,
          const2: undefined,
        },
      ]);
      assert.deepEqual(query.getParam("pagination"), {limit: 1, offset: 2});
      assert.deepEqual(query.getParam("sorting"), {
        property: cube.getProperty("ISO 3"),
        direction: "asc",
      });
      assert.deepEqual(query.getParam("time"), {precision: "year", value: "latest"});
      assert.deepEqual(query.getParam("options"), {parents: false});
    });
  });

  describe("#stringifyQueryURL", () => {
    const ds = new PyTesseractDataSource(PYTESSERACT_SERVER);
    let cube;

    this.beforeAll(async () => {
      cube = await ds.fetchCube("indicators_i_wdi_a").then((cube) => new Cube(cube, ds));
    });

    it("should stringify a Query into a search string", () => {
      const query = cube.query
        .setFormat("jsonrecords")
        .setLocale("es")
        .addMeasure("Measure")
        .addDrilldown("Year")
        .addDrilldown("Country")
        .addProperty("Country.ISO 3")
        .addCut("Year", ["2020", "2021"], {exclusive: false})
        .addCut("Continent", ["af", "as"], {exclusive: true})
        .addFilter("Measure", ["lte", 100000])
        .setPagination(1, 2)
        .setSorting("Country.ISO 3", "asc")
        .setTime("year", "latest")
        .setOption("parents", false);

      const url = ds.stringifyQueryURL(query, "csv");

      const parsedURL = new URL(url);
      const parsedSearch = Object.fromEntries(parsedURL.searchParams);

      assert.strictEqual(
        parsedURL.origin + parsedURL.pathname,
        `${new URL("data.csv", PYTESSERACT_SERVER)}`,
      );
      assert.deepEqual(parsedSearch, {
        cube: "indicators_i_wdi_a",
        locale: "es",
        drilldowns: "Year,Country",
        measures: "Measure",
        properties: "ISO 3",
        include: "Year:2020,2021",
        exclude: "Continent:af,as",
        filters: "Measure.lte.100000",
        limit: "1,2",
        sort: "ISO 3.asc",
        time: "year.latest",
      });
    });
  });
});
