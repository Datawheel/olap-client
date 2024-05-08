import {Calculation, Direction} from "../interfaces/enums";
import {Level} from "../level";
import {type CalcOrMeasure, Measure} from "../measure";
import type {Property} from "../property";
import type {
  Drillable,
  Query,
  QueryCalcGrowth,
  QueryCalcRca,
  QueryCalcTopk,
  QueryCut,
  QueryFilter,
} from "../query";
import {asArray} from "../toolbox/collection";
import {ifNotEmpty} from "../toolbox/validation";
import type {TesseractAggregateURLSearchParams} from "./interfaces";
import {
  joinFullName,
  parseCut,
  parseFilterConstraints,
  splitFullName,
  stringifyFilter,
} from "./utils";

export function extractAggregateSearchParamsFromQuery(
  query: Query,
): Partial<TesseractAggregateURLSearchParams> {
  const captions = query.getParam("captions");

  const locale = query.getParam("locale").slice(0, 2);
  if (locale) {
    const localeTester = new RegExp(`^${locale}\\s|\\s${locale}$`, "i");
    query.getParam("drilldowns").forEach((dd: Drillable) => {
      if (Level.isLevel(dd)) {
        const property = dd.properties.find((prop) => localeTester.test(prop.name));
        property && captions.push(property);
      }
      // TODO: implement namedset
    });
  }

  const options = query.getParam("options");
  const pagination = query.getParam("pagination");
  const sorting = query.getParam("sorting");

  const calculations = query.getParam("calculations");
  const growth = calculations.filter((calc) => calc.kind === "growth").pop() as
    | QueryCalcGrowth
    | undefined;
  const rca = calculations.filter((calc) => calc.kind === "rca").pop() as
    | QueryCalcRca
    | undefined;
  const topk = calculations.filter((calc) => calc.kind === "topk").pop() as
    | QueryCalcTopk
    | undefined;

  /**
   * Supported params are described in https://github.com/tesseract-olap/tesseract/blob/master/tesseract-server/src/handlers/aggregate.rs#L131
   *
   * PENDING IMPLEMENTATION
   * - top_where: Option<String>
   * - rate: Option<String>
   *
   * UNSUPPORTED: distinct, nonempty
   *
   * Keep in mind the stringify functions between aggregate and logiclayer
   * aren't shared:
   * - aggregate uses Level#fullName
   * - logiclayer uses Level#uniqueName
   */

  return {
    captions: ifNotEmpty<Property>(captions, stringifyProperty),
    cuts: ifNotEmpty<QueryCut>(query.getParam("cuts"), stringifyCut),
    drilldowns: ifNotEmpty<Drillable>(query.getParam("drilldowns"), (item) =>
      Level.isLevel(item) ? item.fullName : item.name,
    ),
    filters: ifNotEmpty<QueryFilter>(query.getParam("filters"), stringifyFilter),
    measures: ifNotEmpty<Measure>(query.getParam("measures"), (m) => m.name),
    properties: ifNotEmpty<Property>(query.getParam("properties"), stringifyProperty),

    limit: !pagination.limit
      ? undefined
      : pagination.offset > 0
        ? `${pagination.offset},${pagination.limit}`
        : `${pagination.limit}`,

    sort: Measure.isMeasure(sorting.property)
      ? `${sorting.property.name}.${sorting.direction}`
      : typeof sorting.property === "string"
        ? `${sorting.property}.${sorting.direction}`
        : undefined,

    // booleans
    debug: options.debug,
    exclude_default_members: options.exclude_default_members,
    parents: options.parents,
    sparse: options.sparse,

    // calculations
    growth: growth && `${growth.category.fullName},${growth.value.name}`,
    rca: rca && `${rca.location.fullName},${rca.category.fullName},${rca.value.name}`,
    top:
      topk &&
      ((topk) => {
        const calculation = Measure.isMeasure(topk.value) ? topk.value.name : topk.value;
        return `${topk.amount},${topk.category.fullName},${calculation},${topk.order}`;
      })(topk),
  };

  function stringifyCut(item: QueryCut): string {
    const {drillable} = item;
    const name = Level.isLevel(drillable)
      ? [drillable.dimension.name, drillable.hierarchy.name, drillable.name]
      : splitFullName(drillable.fullName);
    return (
      (item.isExclusive ? "~" : "") +
      (item.isForMatch ? "*" : "") +
      joinFullName(name.concat(item.members.join(",")))
    );
  }

  function stringifyProperty(item: Property): string {
    return joinFullName([
      item.level.dimension.name,
      item.level.hierarchy.name,
      item.level.name,
      item.name,
    ]);
  }
}

export function hydrateQueryFromAggregateSearchParams(
  query: Query,
  params: Partial<TesseractAggregateURLSearchParams>,
): Query {
  const cube = query.cube;

  const levels: Record<string, Level> = {};
  for (const level of cube.levelIterator) {
    levels[level.fullName] = level;
  }

  const props: Record<string, Property> = {};
  for (const prop of cube.propertyIterator) {
    props[prop.fullName] = prop;
  }

  asArray(params.captions).forEach((item: string) => {
    const property = props[item];
    property && query.addCaption(property);
  });

  asArray(params.cuts).forEach((item: string) => {
    const {drillable, members, exclusive, forMatch} = parseCut(item);
    const level = levels[drillable];
    level && query.addCut(level, members, {exclusive, forMatch});
  });

  asArray(params.drilldowns).forEach((item: string) => {
    const level = levels[item];
    level && query.addDrilldown(level);
  });

  asArray(params.filters).forEach((item: string) => {
    const index = item.indexOf(".");
    const measureName = item.slice(0, index) as Calculation;
    const measure = Calculation[measureName] || cube.measuresByName[measureName];
    if (measure) {
      const {const1, const2, joint} = parseFilterConstraints(item);
      query.addFilter(measure, const1, joint, const2);
    }
  });

  asArray(params.measures).forEach((item) => {
    const measure = cube.measuresByName[item];
    measure && query.addMeasure(measure);
  });

  asArray(params.properties).forEach((item) => {
    const property = props[item];
    property && query.addProperty(property);
  });

  if (params.growth) {
    const [lvlFullName, measureName] = params.growth.split(",");
    const level = levels[lvlFullName];
    const measure = cube.measuresByName[measureName];
    level &&
      measure &&
      query.addCalculation("growth", {
        category: level,
        value: measure,
      });
  }

  if (params.rca) {
    const [lvl1FullName, lvl2FullName, measureName] = params.rca.split(",");
    const level1 = levels[lvl1FullName];
    const level2 = levels[lvl2FullName];
    const measure = cube.measuresByName[measureName];
    level1 &&
      level2 &&
      measure &&
      query.addCalculation("rca", {
        category: level1,
        location: level2,
        value: measure,
      });
  }

  if (params.top) {
    const [amountRaw, lvlFullName, calcName, order] = params.top.split(",");
    const amount = Number.parseInt(amountRaw);
    const level = levels[lvlFullName];
    const calculation: CalcOrMeasure =
      Calculation[calcName as Calculation] || cube.measuresByName[calcName];
    amount > 0 &&
      level &&
      calculation &&
      query.addCalculation("topk", {
        amount,
        category: level,
        value: calculation,
        order: Direction[order as "asc" | "desc"] || Direction.DESC,
      });
  }

  if (params.limit != null) {
    const limit = `${params.limit}`.split(",");
    const offset = limit.length === 2 ? limit[0] : "0";
    const amount = limit.length === 2 ? limit[1] : limit[0];
    query.setPagination(Number.parseInt(amount, 10), Number.parseInt(offset, 10));
  }

  if (params.sort) {
    const index = params.sort.lastIndexOf(".");
    const sortProperty = params.sort.slice(0, index) as Calculation;
    const sortOrder = params.sort.slice(index + 1) as "asc" | "desc";
    const calculation = Calculation[sortProperty] || cube.measuresByName[sortProperty];
    calculation && query.setSorting(calculation, Direction[sortOrder] || Direction.DESC);
  }

  typeof params.debug === "boolean" && query.setOption("debug", params.debug);
  typeof params.distinct === "boolean" && query.setOption("distinct", params.distinct);
  typeof params.exclude_default_members === "boolean" &&
    query.setOption("exclude_default_members", params.exclude_default_members);
  typeof params.nonempty === "boolean" && query.setOption("nonempty", params.nonempty);
  typeof params.parents === "boolean" && query.setOption("parents", params.parents);
  typeof params.sparse === "boolean" && query.setOption("sparse", params.sparse);

  // rate:       string;
  // top_where:  string;

  return query;
}
