const assert = require("assert");
const { Client, TesseractDataSource, Comparison } = require("../dist/index.cjs");

/**
 * @template T
 * @param {T[]} list
 * @returns {T}
 */
const randomPick = list => list[Math.floor(Math.random() * list.length)];

const encode = string => encodeURIComponent(string).replace(/%20/g, "+");

/** @type {import("../src").Cube} */
let cube;

const ds = new TesseractDataSource("https://api.oec.world/tesseract/");
const client = new Client(ds);

describe("Query", () => {
  beforeEach(async function() {
    cube = await client.getCubes().then(randomPick);
  });

  describe("#constructor()", () => {
    it("should create a query from a cube.query getter", () => {
      const query = cube.query;
      assert.equal(query.constructor.name, "Query");
      assert.equal(query.cube, cube);
    });
  });

  describe("#addCaption()", () => {
    it("should add a caption to the query", () => {
      for (const level of cube.levelIterator) {
        if (level.properties.length > 0) {
          const query = cube.query;
          const property = randomPick(level.properties);
          assert.equal(Object.keys(query.captions).length, 0, "Query was not empty");

          query.addCaption(property.level, property.name);
          assert.equal(Object.keys(query.captions).length, 1, "First addition failed");

          query.addCaption(level, property.name);
          assert.equal(Object.keys(query.captions).length, 1, "Second addition failed");

          return;
        }
      }
      // Fallback assertion
      // There's no properties in the whole cube
      // We can't test but must do an assertion
      assert.equal(1, 1);
    });
  });

  describe("#addCut()", () => {
    it("should add a cut to the query", () => {
      const query = cube.query;
      const level = randomPick(
        randomPick(randomPick(cube.dimensions).hierarchies).levels
      );

      return client.getMembers(level).then(memberList => {
        const members = memberList.map(m => m.key);
        assert.equal(Object.keys(query.cuts).length, 0);

        query.addCut(level.descriptor, members.slice(0, 2));
        assert.equal(Object.keys(query.cuts).length, 1);
        assert.equal(typeof query.cuts[level.fullName], "object");
        assert.equal(Array.isArray(query.cuts[level.fullName].members), true);
        assert.equal(
          query.cuts[level.fullName].members.length,
          members.slice(0, 2).length
        );

        query.addCut(level.descriptor, members.slice(1, 3));
        assert.equal(Object.keys(query.cuts).length, 1);
        assert.equal(typeof query.cuts[level.fullName], "object");
        assert.equal(Array.isArray(query.cuts[level.fullName].members), true);
        assert.equal(
          query.cuts[level.fullName].members.length,
          members.slice(0, 3).length
        );
      });
    });
  });

  describe("#addDrilldown()", () => {
    it("should add a drilldown to the query", () => {
      const query = cube.query;
      const level = randomPick(
        randomPick(randomPick(cube.dimensions).hierarchies).levels
      );
      assert.equal(query.drilldowns.length, 0);

      query.addDrilldown(level.descriptor);
      assert.equal(query.drilldowns.length, 1);

      query.addDrilldown(level);
      assert.equal(query.drilldowns.length, 1);
    });

    it("should throw if trying to add a drilldown that doesn't exists", () => {
      assert.throws(() => cube.query.addDrilldown("undefined"));
    });
  });

  describe("#addFilter()", () => {
    it("should add a filter to the query", () => {
      const query = cube.query;
      const measure = randomPick(cube.measures);
      assert.equal(query.filters.length, 0);

      query.addFilter(measure.name, ">", 0);
      assert.equal(query.filters.length, 1);
    });

    it("should throw if trying to filter on a measure that doesn't exists", () => {
      assert.throws(() => cube.query.addFilter("undefined", ">", 0));
    });

    it("should throw if trying to filter on an invalid amount", () => {
      const measure = randomPick(cube.measures);
      assert.throws(() => cube.query.addFilter(measure, ">", NaN));
      assert.throws(() => cube.query.addFilter(measure, "<", Infinity));
      assert.throws(() => cube.query.addFilter(measure, "=", "red"));
    });
  });

  describe("#addMeasure()", () => {
    it("should add a Measure to the query", () => {
      const query = cube.query;
      const measure = randomPick(cube.measures);
      assert.equal(query.measures.length, 0);

      query.addMeasure(measure.name);
      assert.equal(query.measures.length, 1);

      query.addMeasure(measure);
      assert.equal(query.measures.length, 1);
    });

    it("should throw if trying to add a measure that doesn't exists", () => {
      assert.throws(() => cube.query.addMeasure("undefined"));
    });
  });

  describe("#addProperty()", () => {
    it("should add a Property to the query", () => {
      for (const level of cube.levelIterator) {
        if (level.properties.length > 0) {
          const query = cube.query;
          const property = randomPick(level.properties);
          assert.equal(Object.keys(query.properties).length, 0, "Query was not empty");

          query.addProperty(property.level, property.name);
          assert.equal(Object.keys(query.properties).length, 1, "First addition failed");

          query.addProperty(level, property.name);
          assert.equal(Object.keys(query.properties).length, 1, "Second addition failed");

          return;
        }
      }
      // Fallback assertion
      assert.equal(1, 1);
    });
  });

  describe("private #getDrillable()", () => {
    it("should get a drillable by name from the cube the query belongs to");
    it("should get a drillable by fullName from the cube the query belongs to");
    it("should get a drillable by uniqueName from the cube the query belongs to");
    it("should get a drillable by descriptor from the cube the query belongs to");
    it("should get a drillable by instance from the cube the query belongs to");
  });

  describe("#getParam()", () => {
    it("should get a caption list from the query");
    it("should get a cut list from the query");
    it("should get a drilldown list from the query");
    it("should get a filter list from the query");
    it("should get the format from the query");
    it("should get growth params from the query");
    it("should get limit params from the query");
    it("should get the locale from the query");
    it("should get a measure list from the query");
    it("should get the boolean params from the query");
    it("should get a property list from the query");
    it("should get RCA params from the query");
    it("should get sorting params from the query");
    it("should get the time frames from the query");
    it("should get topK params from the query");
  });

  describe("private #getProperty()", () => {
    it("should get a QueryProperty object given a level and a property name", () => {});
  });

  describe("#setFormat()", () => {
    it("should set the format of the query", () => {
      const query = cube.query;
      assert.equal(query.format, "jsonrecords");

      query.setFormat("csv");
      assert.equal(query.format, "csv");
    });
  });

  describe("#setGrowth()", () => {
    it("should set growth params to the query");
  });

  describe("#setLocale()", () => {
    it("should set the locale of the query", () => {
      const query = cube.query;
      assert.equal(query.locale, "");

      query.setLocale("es");
      assert.equal(query.locale, "es");
    });
  });

  describe("#setOption()", () => {
    it("should set boolean options to the query", () => {
      const query = cube.query;
      assert.strictEqual(query.options.debug, undefined);
      assert.strictEqual(query.options.distinct, undefined);
      assert.strictEqual(query.options.nonempty, undefined);
      assert.strictEqual(query.options.parents, undefined);
      assert.strictEqual(query.options.sparse, undefined);

      query
        .setOption("debug", true)
        .setOption("distinct", false)
        .setOption("nonempty", undefined)
        .setOption("parents", null)
        .setOption("sparse", "");

      assert.strictEqual(query.options.debug, true);
      assert.strictEqual(query.options.distinct, false);
      assert.strictEqual(query.options.nonempty, undefined);
      assert.strictEqual(query.options.parents, undefined);
      assert.strictEqual(query.options.sparse, false);
    });
  });

  describe("#setPagination()", () => {
    it("should set pagination options to the query");
  });

  describe("#setRCA()", () => {
    it("should set RCA params to the query");
  });

  describe("#setSorting()", () => {
    it("should set sorting params to the query");
  });

  describe("#setTime()", () => {
    it("should set time frames to the query");
  });

  describe("#setTop()", () => {
    it("should set topK params to the query");
  });

  describe("#toJSON()", () => {
    it("should convert the query into a raw object", () => {
      const level1 = randomPick(
        randomPick(randomPick(cube.dimensions).hierarchies).levels
      );
      const level2 = randomPick(
        randomPick(randomPick(cube.dimensions).hierarchies).levels
      );
      const measure = randomPick(cube.measures);

      const query = cube.query
        .addDrilldown(level1)
        .addDrilldown(level2)
        .addMeasure(measure)
        .setOption("debug", true)
        .setFormat("csv")
        .setGrowth(level1, measure)
        .setSorting(measure, "desc");

      const q = query.toJSON();
      assert.equal(typeof q, "object");
      assert.equal(q.debug, true);
      assert.equal(q.format, "csv");
      assert.equal(q.sortDirection, "desc");
      assert.equal(q.sortProperty, measure.name);

      assert.equal(Array.isArray(q.measures), true);
      assert.equal(q.measures[0], measure.name);

      assert.equal(Array.isArray(q.drilldowns), true);
      assert.equal(q.drilldowns.includes(level1.fullName), true);
      assert.equal(q.drilldowns.includes(level2.fullName), true);

      assert.equal(typeof q.growth, "object");
      assert.equal(q.growth.level, level1.fullName);
      assert.equal(q.growth.measure, measure.name);
    });
  });

  describe("#toSource()", () => {
    it("should convert the query into its javascript source", () => {
      const level1 = randomPick(
        randomPick(randomPick(cube.dimensions).hierarchies).levels
      );
      const level2 = randomPick(
        randomPick(randomPick(cube.dimensions).hierarchies).levels
      );
      const measure = randomPick(cube.measures);

      const baseQuery = cube.query
        .addDrilldown(level1)
        .addDrilldown(level2)
        .addMeasure(measure)
        .setFormat("csv")
        .addFilter("rca", [">", 0.8])
        .setGrowth(level1, measure)
        .setOption("debug", undefined)
        .setOption("distinct", false)
        .setOption("parents", true)
        .setRCA(level1, level2, measure)
        .setSorting(measure, "desc")
        .setTop(5, level2, measure, "asc");

      const queryEvaluator = new Function("Comparison", "query", `return ${baseQuery.toSource()}`);
      const derivedQuery = queryEvaluator(Comparison, cube.query);
      assert.equal(baseQuery.toString(), derivedQuery.toString());
    });
  });

  describe("#toString()", () => {
    it("should convert the query into a URLSearchParams string", () => {
      const level1 = randomPick(
        randomPick(randomPick(cube.dimensions).hierarchies).levels
      );
      const level2 = randomPick(
        randomPick(randomPick(cube.dimensions).hierarchies).levels
      );
      const measure = randomPick(cube.measures);

      const query = cube.query
        .addDrilldown(level1)
        .addDrilldown(level2)
        .addMeasure(measure)
        .setFormat("csv")
        .setGrowth(level1, measure)
        .setOption("debug", undefined)
        .setOption("distinct", false)
        .setOption("parents", true)
        .setRCA(level1, level2, measure)
        .setSorting(measure, "desc")
        .setTop(5, level2, measure, "asc");

      const qp = query.toString();
      assert.equal(typeof qp, "string");
      assert.ok(qp.includes(`cube=${encode(cube.name)}`));
      assert.equal(qp.includes(`&debug=`), false);
      assert.ok(qp.includes(`&distinct=false`));
      assert.ok(qp.includes(`&drilldowns%5B%5D=${encode(level1.fullName)}`));
      assert.ok(qp.includes(`&drilldowns%5B%5D=${encode(level2.fullName)}`));
      assert.ok(qp.includes(`&format=csv`));
      assert.ok(qp.includes(`&growth%5Blevel%5D=${encode(level1.fullName)}`));
      assert.ok(qp.includes(`&growth%5Bmeasure%5D=${encode(measure.name)}`));
      assert.ok(qp.includes(`&measures%5B%5D=${encode(measure.name)}`));
      assert.ok(qp.includes(`&parents=true`));
      assert.ok(qp.includes(`&rca%5Blevel1%5D=${encode(level1.fullName)}`));
      assert.ok(qp.includes(`&rca%5Blevel2%5D=${encode(level2.fullName)}`));
      assert.ok(qp.includes(`&rca%5Bmeasure%5D=${encode(measure.name)}`));
      assert.ok(qp.includes(`&server=${encode(cube.server)}`));
      assert.ok(qp.includes(`&sortDirection=desc`));
      assert.ok(qp.includes(`&sortProperty=${encode(measure.name)}`));
    });
  });
});
