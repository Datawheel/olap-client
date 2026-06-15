const assert = require("node:assert");
const {
  PyTesseractDataSource,
  Cube,
  Comparison,
  TimePrecision,
  TimeValue,
} = require("../..");

// Ensure online test runs before
require("../online.spec");

const {PYTESSERACT_SERVER = ""} = process.env;

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
        // @ts-expect-error
        new PyTesseractDataSource();
      });
    });

    it("should throw with a clear error message", () => {
      assert.throws(
        () => {
          // @ts-expect-error
          new PyTesseractDataSource();
        },
        {name: "TypeError", message: "Invalid pytesseract server URL: undefined"},
      );
    });

    it("should throw if something besides a string is passed", () => {
      assert.throws(() => {
        // @ts-expect-error
        new PyTesseractDataSource({url: "/tesseract"});
      });
      assert.throws(() => {
        // @ts-expect-error
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

  const describeIfOnline = PYTESSERACT_SERVER ? describe : describe.skip;

  describeIfOnline("#checkStatus", function () {
    /** @type {PyTesseractDataSource} */ let ds;

    this.beforeAll(() => {
      ds = new PyTesseractDataSource(PYTESSERACT_SERVER);
    });

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

  describeIfOnline("#execQuery", function () {
    /** @type {PyTesseractDataSource} */ let ds;
    // @ts-expect-error
    let query;

    this.beforeAll(async () => {
      ds = new PyTesseractDataSource(PYTESSERACT_SERVER);
      query = await ds.fetchCube("indicators_i_wdi_a").then((plainCube) => {
        const cube = new Cube(plainCube, ds);
        return cube.query
          .setLocale("en")
          .addMeasure("Measure")
          .addDrilldown("Year")
          .addDrilldown("Country Official")
          .addCut("Continent Official", ["na"])
          .setFormat("jsonrecords");
      });
    });

    it("should query the server", async () => {
      // @ts-expect-error
      const res = await ds.execQuery(query);

      // @ts-expect-error
      assert.match(res.url, /\/data\.jsonrecords\?/);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.length, 2275);

      const columns = Object.keys(res.data[0]);
      assert.ok(columns.includes("Year"));
      assert.ok(columns.includes("Country Official"));
      assert.ok(columns.includes("Country Official ID"));
      assert.ok(columns.includes("Measure"));
    });
  });

  describeIfOnline("#fetchCubes", function () {
    /** @type {PyTesseractDataSource} */ let ds;

    this.beforeAll(() => {
      ds = new PyTesseractDataSource(PYTESSERACT_SERVER);
    });

    it("should get a list of cubes from the server", async () => {
      const cubes = await ds.fetchCubes();
      assert.ok(cubes.length > 0);
      assert.ok(cubes.some((cube) => cube.name === "indicators_i_wdi_a"));
    });

    it("should pass optional params to the request", async () => {
      const cubes = await ds.fetchCubes({locale: "es"});
      assert.ok(cubes.length > 0);
      const cube = cubes.find((cube) => cube.name === "indicators_i_wdi_a");
      assert.ok(cube);
      const measure = cube.measures.find((mea) => mea.name === "Measure");
      assert.ok(measure);
      assert.strictEqual(measure.caption, "Medida");
    });
  });

  describeIfOnline("#fetchCube", function () {
    /** @type {PyTesseractDataSource} */ let ds;

    this.beforeAll(() => {
      ds = new PyTesseractDataSource(PYTESSERACT_SERVER);
    });

    it("should get a specific cube from the server", async () => {
      const cube = await ds.fetchCube("indicators_i_wdi_a");
      assert.strictEqual(cube.name, "indicators_i_wdi_a");
    });

    it("should pass optional params to the request", async () => {
      const cube = await ds.fetchCube("indicators_i_wdi_a", {locale: "es"});
      assert.strictEqual(cube.name, "indicators_i_wdi_a");
      const dimension = cube.dimensions.find((dim) => dim.name === "Country Official");
      assert.ok(dimension);
      assert.strictEqual(dimension.caption, "País");
    });
  });

  describeIfOnline("#fetchMembers", function () {
    /** @type {PyTesseractDataSource} */ let ds;
    // @ts-expect-error
    let level;

    this.beforeAll(async () => {
      ds = new PyTesseractDataSource(PYTESSERACT_SERVER);
      level = await ds.fetchCube("indicators_i_wdi_a").then((plainCube) => {
        const cube = new Cube(plainCube, ds);
        return cube.getLevel("Year");
      });
    });

    it("should get a list of members for a cube level", async () => {
      // @ts-expect-error
      const members = await ds.fetchMembers(level);
      assert.ok(members.length > 60);
      assert.ok(members.map((member) => member.key).includes(2000));
    });
  });

  describeIfOnline("#fetchMember", function () {
    /** @type {PyTesseractDataSource} */ let ds;
    // @ts-expect-error
    let level;

    this.beforeAll(async () => {
      ds = new PyTesseractDataSource(PYTESSERACT_SERVER);
      level = await ds.fetchCube("indicators_i_wdi_a").then((plainCube) => {
        const cube = new Cube(plainCube, ds);
        return cube.getLevel("Year");
      });
    });

    it("should get a single member for a cube level", async () => {
      // @ts-expect-error
      const member = await ds.fetchMember(level, 1960);
      assert.strictEqual(member.key, 1960);
    });

    it("should throw a clear error if the member does not exist", async () => {
      // @ts-expect-error
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

  describeIfOnline("#parseQueryURL", function () {
    /** @type {PyTesseractDataSource} */ let ds;
    const search = new URLSearchParams([
      ["cube", "indicators_i_wdi_a"],
      ["locale", "es"],
      ["drilldowns", "Year,Country Official"],
      ["measures", "Measure"],
      ["properties", "ISO2"],
      ["include", "Year:2020,2021"],
      ["include", "Year:2019"],
      ["exclude", "Continent Official:af,as"],
      ["exclude", "Continent Official:af,sa;Country Official:euspa"],
      ["filters", "Measure.lte.100000"],
      ["limit", "1,2"],
      ["sort", "ISO2.asc"],
      ["time", "year.latest"],
      ["parents", "false"],
    ]);
    // @ts-expect-error
    let cube;

    this.beforeAll(async () => {
      ds = new PyTesseractDataSource(PYTESSERACT_SERVER);
      cube = await ds.fetchCube("indicators_i_wdi_a").then((cube) => new Cube(cube, ds));
    });

    it("should parse a search string into a Query", () => {
      let query;

      assert.doesNotThrow(() => {
        // @ts-expect-error
        query = ds.parseQueryURL(cube.query, `http://testserver/?${search}`);
      });

      // @ts-expect-error
      assert.strictEqual(query.cube.name, "indicators_i_wdi_a");
      // @ts-expect-error
      assert.strictEqual(query.getParam("locale"), "es");
      // @ts-expect-error
      assert.deepEqual(query.getParam("drilldowns"), [
        // @ts-expect-error
        cube.getLevel("Year"),
        // @ts-expect-error
        cube.getLevel("Country Official"),
      ]);
      // @ts-expect-error
      assert.deepEqual(query.getParam("measures"), [cube.getMeasure("Measure")]);
      // @ts-expect-error
      assert.deepEqual(query.getParam("properties"), [cube.getProperty("ISO2")]);
      // @ts-expect-error
      assert.deepEqual(query.getParam("cuts"), [
        {
          // @ts-expect-error
          drillable: cube.getLevel("Year"),
          members: ["2020", "2021", "2019"],
          isExclusive: false,
          isForMatch: undefined,
        },
        {
          // @ts-expect-error
          drillable: cube.getLevel("Continent Official"),
          members: ["af", "as", "sa"],
          isExclusive: true,
          isForMatch: undefined,
        },
        {
          // @ts-expect-error
          drillable: cube.getLevel("Country Official"),
          members: ["euspa"],
          isExclusive: true,
          isForMatch: undefined,
        },
      ]);
      // @ts-expect-error
      assert.deepEqual(query.getParam("filters"), [
        {
          // @ts-expect-error
          measure: cube.getMeasure("Measure"),
          const1: ["lte", 100000],
          joint: undefined,
          const2: undefined,
        },
      ]);
      // @ts-expect-error
      assert.deepEqual(query.getParam("pagination"), {limit: 1, offset: 2});
      // @ts-expect-error
      assert.deepEqual(query.getParam("sorting"), {
        // @ts-expect-error
        property: cube.getProperty("ISO2"),
        direction: "asc",
      });
      // @ts-expect-error
      assert.deepEqual(query.getParam("time"), {precision: "year", value: "latest"});
      // @ts-expect-error
      assert.deepEqual(query.getParam("options"), {parents: false});
    });
  });

  describeIfOnline("#stringifyQueryURL", function () {
    /** @type {PyTesseractDataSource} */ let ds;
    /** @type {import("../..").Cube} */ let cube;

    this.beforeAll(async () => {
      ds = new PyTesseractDataSource(PYTESSERACT_SERVER);
      cube = await ds.fetchCube("indicators_i_wdi_a").then((cube) => new Cube(cube, ds));
    });

    it("should stringify a Query into a search string", () => {
      const query = cube.query
        .setFormat("csv")
        .setLocale("es")
        .addMeasure("Measure")
        .addDrilldown("Year")
        .addDrilldown("Country Official")
        .addProperty("Country Official.ISO2")
        .addCut("Year", ["2020", "2021"], {exclusive: false})
        .addCut("Country Official", ["euspa"], {exclusive: false})
        .addCut("Continent Official", ["af", "as"], {exclusive: true})
        .addCut("Continent Official", ["af", "sa"], {exclusive: true})
        .addFilter("Measure", [Comparison.LTE, 100000])
        .setPagination(1, 2)
        .setSorting("Country Official.ISO2", "asc")
        .setTime(TimePrecision.YEAR, TimeValue.LATEST)
        .setOption("parents", false);

      const url = ds.stringifyQueryURL(query);

      const parsedURL = new URL(url);
      const parsedSearch = Object.fromEntries(parsedURL.searchParams);

      assert.strictEqual(
        parsedURL.origin + parsedURL.pathname,
        `${new URL("data.csv", PYTESSERACT_SERVER)}`,
      );
      assert.deepEqual(parsedSearch, {
        cube: "indicators_i_wdi_a",
        locale: "es",
        drilldowns: "Year,Country Official",
        measures: "Measure",
        properties: "ISO2",
        include: "Year:2020,2021;Country Official:euspa",
        exclude: "Continent Official:af,as,sa",
        filters: "Measure.lte.100000",
        limit: "1,2",
        sort: "ISO2.asc",
        time: "year.latest",
      });
    });
  });
});
