const assert = require("assert");
const {Client, Comparison, Direction, Format, TimePrecision, TimeValue, TesseractDataSource} = require("../dist/index.cjs");
const {TestDataSource} = require("./datasource");
const {encode, randomLevel, randomPick, randomQuery} = require("./utils");

describe("Query", () => {
  const ds = new TestDataSource();
  const client = new Client(ds);

  /** @type {import("..").Cube} */
  let cube;

  beforeEach(async () => {
    cube = await client.getCubes().then(randomPick);
  });

  describe("#constructor()", () => {
    it("should create a query from a cube.query getter", () => {
      const query = cube.query;
      assert.strictEqual(query.constructor.name, "Query");
      assert.strictEqual(query.cube, cube);
    });
  });

  describe("#addCalculation", () => {
    /** @type {import("..").Level} */ let category;
    /** @type {import("..").Level} */ let location;
    /** @type {import("..").Measure} */ let measure;

    beforeEach(() => {
      category = randomLevel(cube);
      location = randomLevel(cube, category);
      measure = randomPick(cube.measures);
    });

    it("should add a growth calculation to the query", () => {
      const query = cube.query;
      query.addCalculation("growth", {
        category: category.descriptor,
        value: measure.name,
      });

      const [calc] = query.getParam("calculations");
      if (calc.kind !== "growth") {
        throw new Error("Selected calculation is not 'growth'.");
      }

      assert.strictEqual(calc.category, category);
      assert.strictEqual(calc.value, measure);
    });

    it("should add a rca calculation to the query", () => {
      const query = cube.query;
      query.addCalculation("rca", {
        category: category.descriptor,
        location: location.descriptor,
        value: measure.name,
      });

      const [calc] = query.getParam("calculations");
      if (calc.kind !== "rca") {
        throw new Error("Selected calculation is not 'rca'.");
      }

      assert.strictEqual(calc.category, category);
      assert.strictEqual(calc.value, measure);
    });

    it("should add a topk calculation to the query", () => {
      const query = cube.query;
      query.addCalculation("topk", {
        amount: 5,
        category: category.descriptor,
        order: Direction.ASC,
        value: measure.name,
      });

      const [calc] = query.getParam("calculations");
      if (calc.kind !== "topk") {
        throw new Error("Selected calculation is not 'topk'.");
      }

      assert.strictEqual(calc.amount, 5);
      assert.strictEqual(calc.category, category);
      assert.strictEqual(calc.order, "asc");
      assert.strictEqual(calc.value, measure);
    });
  });

  describe("#addCaption()", () => {
    it("should add a caption by property unique name", () => {
      const level = randomLevel(cube);
      const property = randomPick(level.properties);

      const query = cube.query.addCaption(property.uniqueName);
      const captions = query.getParam("captions");
      assert.strictEqual(captions[0], property);
    });

    it("should add a caption by property full name", () => {
      const level = randomLevel(cube);
      const property = randomPick(level.properties);

      const query = cube.query.addCaption(property.fullName);
      const captions = query.getParam("captions");
      assert.strictEqual(captions[0], property);
    });

    it("should add a caption by property descriptor", () => {
      const level = randomLevel(cube);
      const property = randomPick(level.properties);

      const query = cube.query.addCaption(property.descriptor);
      const captions = query.getParam("captions");
      assert.strictEqual(captions[0], property);
    });

    it("should not add duplicated captions", () => {
      const property = randomPick([...cube.propertyIterator]);

      const query = cube.query
        .addCaption(property.descriptor)
        .addCaption(property.uniqueName);

      const captions = query.getParam("captions");
      assert.strictEqual(captions.length, 1);
      assert.strictEqual(captions[0], property);
      assert.strictEqual(captions[1], undefined);
    });

    it("should not add multiple captions for the same level", () => {
      const level = [...cube.levelIterator].find(lvl => lvl.properties.length > 1);
      const property1 = randomPick(level.properties);
      const property2 = randomPick(level.properties, property1);

      const query = cube.query
        .addCaption(property1.descriptor)
        .addCaption(property2.uniqueName);

      const captions = query.getParam("captions");
      assert.strictEqual(captions.length, 1);
      assert.strictEqual(captions[0], property2);
      assert.strictEqual(captions[1], undefined);
    });
  });

  describe("#addCut()", () => {
    it("should add a simple cut to the query", async () => {
      const level = randomLevel(cube);
      const memberList = await client.getMembers(level);
      const members = memberList.slice(0, 2).map(m => `${m.key}`);

      const query = cube.query.addCut(level.descriptor, members);

      const cuts = query.getParam("cuts");
      assert.strictEqual(cuts.length, 1);
      assert.strictEqual(typeof cuts[0], "object");
      assert.strictEqual(cuts[0].drillable, level);
      assert.strictEqual(Array.isArray(cuts[0].members), true);
      assert.deepStrictEqual(cuts[0].members, members);
    });

    it("should add an exclusive cut to the query", async () => {
      const level = randomLevel(cube);
      const memberList = await client.getMembers(level);
      const members = memberList.slice(1, 3).map(m => `${m.key}`);

      const query = cube.query.addCut(level.descriptor, members, {exclusive: true});

      const cuts = query.getParam("cuts");
      assert.strictEqual(cuts.length, 1);
      assert.strictEqual(typeof cuts[0], "object");
      assert.strictEqual(cuts[0].isExclusive, true);
    });

    it("should throw if trying to use a level that doesn't exists", () => {
      assert.throws(() => cube.query.addCut("undefined", [1, 2, 3]));
    });
  });

  describe("#addDrilldown()", () => {
    it("should add a drilldown by level unique name", () => {
      const level = randomLevel(cube);

      const query = cube.query.addDrilldown(level.uniqueName);

      const drilldowns = query.getParam("drilldowns");
      assert.strictEqual(drilldowns.length, 1);
      assert.strictEqual(drilldowns[0], level);
    });

    it("should add a drilldown by level full name", () => {
      const level = randomLevel(cube);

      const query = cube.query.addDrilldown(level.fullName);

      const drilldowns = query.getParam("drilldowns");
      assert.strictEqual(drilldowns.length, 1);
      assert.strictEqual(drilldowns[0], level);
    });

    it("should add a drilldown by level descriptor", () => {
      const level = randomLevel(cube);

      const query = cube.query.addDrilldown(level.descriptor);

      const drilldowns = query.getParam("drilldowns");
      assert.strictEqual(drilldowns.length, 1);
      assert.strictEqual(drilldowns[0], level);
    });

    it("should add a drilldown by level object", () => {
      const level = randomLevel(cube);

      const query = cube.query.addDrilldown(level);

      const drilldowns = query.getParam("drilldowns");
      assert.strictEqual(drilldowns.length, 1);
      assert.strictEqual(drilldowns[0], level);
    });

    it("should throw if trying to add a level that doesn't exists", () => {
      assert.throws(() => cube.query.addDrilldown("undefined"));
    });
  });

  describe("#addFilter()", () => {
    it("should add a simple filter to the query", () => {
      const measure = randomPick(cube.measures);

      const query = cube.query.addFilter(measure.name, [Comparison.GT, 0]);

      const filters = query.getParam("filters");
      assert.strictEqual(filters.length, 1);
      assert.strictEqual(filters[0].measure, measure);
      assert.deepStrictEqual(filters[0].const1, [Comparison.GT, 0]);
      assert.deepStrictEqual(filters[0].joint, undefined);
      assert.deepStrictEqual(filters[0].const2, undefined);
    });

    it("should add a double filter to the query", () => {
      const measure = randomPick(cube.measures);

      const query = cube.query
        .addFilter(measure, [Comparison.GT, 0], "and", [Comparison.LTE, 100]);

      const filters = query.getParam("filters");
      assert.strictEqual(filters.length, 1);
      assert.strictEqual(filters[0].measure, measure);
      assert.deepStrictEqual(filters[0].const1, ["gt", 0]);
      assert.deepStrictEqual(filters[0].joint, "and");
      assert.deepStrictEqual(filters[0].const2, ["lte", 100]);
    });

    it("should throw if trying to filter on a measure that doesn't exists", () => {
      assert.throws(() => cube.query.addFilter("undefined", [Comparison.GT, 0]));
    });

    it("should throw if trying to filter on an invalid comparison operator", () => {
      const measure = randomPick(cube.measures);
      assert.throws(() => cube.query.addFilter(measure, [null, 0]));
      assert.throws(() => cube.query.addFilter(measure, [true, 0]));
      assert.throws(() => cube.query.addFilter(measure, [Number.POSITIVE_INFINITY, 0]));
    });

    it("should throw if trying to filter on an invalid amount", () => {
      const measure = randomPick(cube.measures);
      assert.throws(() => cube.query.addFilter(measure, [Comparison.GTE, Number.NaN]));
      assert.throws(() => cube.query.addFilter(measure, [Comparison.LT, Number.POSITIVE_INFINITY]));
      assert.throws(() => cube.query.addFilter(measure, [Comparison.EQ, "red"]));
    });
  });

  describe("#addMeasure()", () => {
    it("should add a measure by name", () => {
      const measure = randomPick(cube.measures);

      const query = cube.query.addMeasure(measure.name);

      const measures = query.getParam("measures");
      assert.strictEqual(measures.length, 1);
      assert.strictEqual(measures[0], measure);
    });

    it("should add a measure by object", () => {
      const measure = randomPick(cube.measures);

      const query = cube.query.addMeasure(measure);

      const measures = query.getParam("measures");
      assert.strictEqual(measures.length, 1);
      assert.strictEqual(measures[0], measure);
    });

    it("should throw if trying to add a measure that doesn't exists", () => {
      assert.throws(() => cube.query.addMeasure("undefined"));
    });
  });

  describe("#addProperty()", () => {
    it("should add a property by unique name", () => {
      const property = randomPick([...cube.propertyIterator]);

      const query = cube.query.addProperty(property.uniqueName);

      const properties = query.getParam("properties");
      assert.strictEqual(properties[0], property);
    });

    it("should add a property by full name", () => {
      const property = randomPick([...cube.propertyIterator]);

      const query = cube.query.addProperty(property.fullName);

      const properties = query.getParam("properties");
      assert.strictEqual(properties[0], property);
    });

    it("should add a property by property descriptor", () => {
      const property = randomPick([...cube.propertyIterator]);

      const query = cube.query.addProperty(property.descriptor);

      const properties = query.getParam("properties");
      assert.strictEqual(properties[0], property);
    });

    it("should add a property by property object", () => {
      const property = randomPick([...cube.propertyIterator]);

      const query = cube.query.addProperty(property);

      const properties = query.getParam("properties");
      assert.strictEqual(properties[0], property);
    });

    it("should throw if trying to add a property that doesn't exists", () => {
      assert.throws(() => cube.query.addProperty("undefined"));
    });
  });

  describe("#setFormat()", () => {
    it("should be 'jsonrecords' by default", () => {
      const format = cube.query.getParam("format");
      assert.strictEqual(format, Format.jsonrecords);
    });

    it("should set the format using the Format enum", () => {
      const query = cube.query.setFormat(Format.csv);
      const format = query.getParam("format");
      assert.strictEqual(format, Format.csv);
    });

    it("should set the format using a string", () => {
      const query = cube.query.setFormat("xls");
      const format = query.getParam("format");
      assert.strictEqual(format, "xls");
    });
  });

  describe("#setLocale()", () => {
    it("should be empty by default", () => {
      const locale = cube.query.getParam("locale");
      assert.strictEqual(locale, "");
    });

    it("should set the locale using a string", () => {
      const query = cube.query.setLocale("es");
      const locale = query.getParam("locale");
      assert.strictEqual(locale, "es");
    });
  });

  describe("#setOption()", () => {
    it("should ignore undefined and null", () => {
      const query = cube.query;

      const optionsBefore = query.getParam("options");
      assert.ok(!optionsBefore.hasOwnProperty("debug"));
      assert.ok(!optionsBefore.hasOwnProperty("distinct"));

      query.setOption("debug", undefined);
      query.setOption("distinct", null);

      const optionsAfter = query.getParam("options");
      assert.ok(!optionsAfter.hasOwnProperty("debug"));
      assert.ok(!optionsAfter.hasOwnProperty("distinct"));
    });

    it("should save boolean values", () => {
      const query = cube.query;

      const optionsBefore = query.getParam("options");
      assert.strictEqual(typeof optionsBefore.nonempty, "undefined");
      assert.strictEqual(typeof optionsBefore.parents, "undefined");

      query.setOption("nonempty", true);
      query.setOption("parents", false);

      const optionsAfter = query.getParam("options");
      assert.strictEqual(typeof optionsAfter.nonempty, "boolean");
      assert.strictEqual(typeof optionsAfter.parents, "boolean");
    });

    it("should save non-boolean values as booleans", () => {
      const query = cube.query;

      query.setOption("debug", "");
      query.setOption("distinct", "0");
      query.setOption("nonempty", 0);
      query.setOption("parents", 1);
      query.setOption("sparse", Number.NaN);

      const options = query.getParam("options");
      assert.strictEqual(options.debug, false);
      assert.strictEqual(options.distinct, true);
      assert.strictEqual(options.nonempty, false);
      assert.strictEqual(options.parents, true);
      assert.strictEqual(options.sparse, false);
    });
  });

  describe("#setPagination()", () => {
    it("should set pagination limit", () => {
      const query = cube.query.setPagination(10);

      const pagination = query.getParam("pagination");
      assert.strictEqual(pagination.limit, 10);
      assert.strictEqual(pagination.offset, 0);
    });

    it("should set pagination limit and offset", () => {
      const query = cube.query.setPagination(10, 5);

      const pagination = query.getParam("pagination");
      assert.strictEqual(pagination.limit, 10);
      assert.strictEqual(pagination.offset, 5);
    });

    it("should clear both pagination options", () => {
      const query = cube.query.setPagination(undefined);

      const pagination = query.getParam("pagination");
      assert.strictEqual(pagination.limit, 0);
      assert.strictEqual(pagination.offset, 0);
    });
  });

  describe("#setSorting()", () => {
    it("should set a sorting by measure name", () => {
      const measure = randomPick(cube.measures);

      const query = cube.query.setSorting(measure.name);

      const sorting = query.getParam("sorting");
      assert.strictEqual(sorting.direction, Direction.DESC);
      assert.strictEqual(sorting.property, measure);
    });

    it("should set a sorting by measure object", () => {
      const measure = randomPick(cube.measures);

      const query = cube.query.setSorting(measure, false);

      const sorting = query.getParam("sorting");
      assert.strictEqual(sorting.direction, Direction.ASC);
      assert.strictEqual(sorting.property, measure);
    });

    it("should set a sorting by property unique name", () => {
      const level = randomLevel(cube);
      const property = randomPick(level.properties);

      const query = cube.query.setSorting(property.uniqueName, true);

      const sorting = query.getParam("sorting");
      assert.strictEqual(sorting.direction, Direction.DESC);
      assert.strictEqual(sorting.property, property);
    });

    it("should set a sorting by property full name", () => {
      const level = randomLevel(cube);
      const property = randomPick(level.properties);

      const query = cube.query.setSorting(property.fullName, "asc");

      const sorting = query.getParam("sorting");
      assert.strictEqual(sorting.direction, Direction.ASC);
      assert.strictEqual(sorting.property, property);
    });

    it("should set a sorting by property descriptor", () => {
      const level = randomLevel(cube);
      const property = randomPick(level.properties);

      const query = cube.query.setSorting(property.descriptor, "desc");

      const sorting = query.getParam("sorting");
      assert.strictEqual(sorting.direction, Direction.DESC);
      assert.strictEqual(sorting.property, property);
    });

    it("should set a sorting by property object", () => {
      const level = randomLevel(cube);
      const property = randomPick(level.properties);

      const query = cube.query.setSorting(property, Direction.ASC);

      const sorting = query.getParam("sorting");
      assert.strictEqual(sorting.direction, Direction.ASC);
      assert.strictEqual(sorting.property, property);
    });
  });

  describe("#setTime()", () => {
    it("should set a numeric timeframe to the query", () => {
      const query = cube.query.setTime(TimePrecision.WEEK, 4);
      const timeframe = query.getParam("time");
      assert.strictEqual(timeframe.precision, "week");
      assert.strictEqual(timeframe.value, 4);
    });

    it("should set a conceptual timeframe to the query", () => {
      const query = cube.query.setTime(TimePrecision.QUARTER, TimeValue.OLDEST);
      const timeframe = query.getParam("time");
      assert.strictEqual(timeframe.precision, "quarter");
      assert.strictEqual(timeframe.value, "oldest");
    });
  });

  describe("#fromJSON() / #toJSON()", () => {
    it("should hydrate a query from a plain JSON object", () => {
      const queryExpected = randomQuery(cube);
      const jsonExpected = queryExpected.toJSON();

      const queryActual = cube.query.fromJSON(jsonExpected);
      const jsonActual = queryActual.toJSON();

      assert.deepStrictEqual(jsonActual, jsonExpected);
    });
  });

  describe("#toSource()", () => {
    it("should convert the query into its javascript source", () => {
      const queryExpected = randomQuery(cube);
      const queryEvaluator = new Function("query", "enums", `
const {Comparison, Direction, Format} = enums;
return ${queryExpected.toSource()};
`);
      const queryActual = queryEvaluator(cube.query, {Comparison, Direction, Format});

      assert.deepStrictEqual(queryActual.toJSON(), queryExpected.toJSON());
    });
  });

  describe("#toString()", () => {
    it("should convert the query into a URLSearchParams string", () => {
      const category = randomLevel(cube);
      const location = randomLevel(cube, category);
      const value = randomPick(cube.measures);

      const query = cube.query
        .addDrilldown(category)
        .addDrilldown(location)
        .addMeasure(value)
        .addCalculation("growth", {category, value})
        .addCalculation("rca", {category, location, value})
        .addCalculation("topk", {amount: 5, category: location, value, order: "asc"})
        .setFormat("csv")
        .setOption("debug", undefined)
        .setOption("distinct", false)
        .setOption("parents", true)
        .setSorting(value, Direction.DESC);

      const qp = query.toString();
      assert.strictEqual(typeof qp, "string");

      assert.ok(qp.includes(`cube=${cube.name}`));
      assert.strictEqual(qp.includes(`options%5Bdebug%5D=`), false);
      assert.ok(qp.includes(`options%5Bdistinct%5D=false`));
      assert.ok(qp.includes(`drilldowns%5B%5D=${encode(category.fullName)}`));
      assert.ok(qp.includes(`drilldowns%5B%5D=${encode(location.fullName)}`));
      assert.ok(qp.includes(`format=csv`));
      assert.ok(qp.includes(`calculations%5B%5D=growth%3A${encode(category.fullName)}%2C${encode(value.name)}`));
      assert.ok(qp.includes(`calculations%5B%5D=rca%3A${encode(category.fullName)}%2C${encode(location.fullName)}%2C${encode(value.name)}`));
      assert.ok(qp.includes(`calculations%5B%5D=topk%3A${5}%2C${encode(location.fullName)}%2C${Direction.ASC}%2C${encode(value.name)}`));
      assert.ok(qp.includes(`measures%5B%5D=${encode(value.name)}`));
      assert.ok(qp.includes(`options%5Bparents%5D=true`));
      assert.ok(qp.includes(`server=${encode(cube.server)}`));
      assert.ok(qp.includes(`sort_direction=desc`));
      assert.ok(qp.includes(`sort_property=${encode(value.name)}`));
    });
  });
});
