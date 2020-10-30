import { CalculationName, Direction, TimePrecision, TimeValue } from "../enums";
import {
  Drillable,
  QueryFilter,
  QueryGrowth,
  QueryPagination,
  QueryProperty,
  QueryRCA,
  QuerySorting,
  QueryTimeframe,
  QueryTopk
} from "../interfaces";
import Level from "../level";
import Measure from "../measure";
import { Query } from "../query";
import {
  ifNotEmpty,
  ifValid,
  isQueryFilter,
  isQueryGrowth,
  isQueryPagination,
  isQueryRCA,
  isQuerySorting,
  isQueryTimeframe,
  isQueryTopk
} from "../utils";
import { TesseractLogicLayerURLSearchParams } from "./interfaces";
import {
  joinFullName,
  parseFilterConstraints,
  splitFullName,
  stringifyFilter,
  stringifyPagination,
  stringifyProperty,
  stringifySorting
} from "./utils";

export function logicLayerQueryBuilder(
  query: Query
): Partial<TesseractLogicLayerURLSearchParams> {
  const cube = query.cube;
  const drilldowns = ifNotEmpty<Drillable>(query.getParam("drilldowns"), (drillable) =>
    Level.isLevel(drillable) ? drillable.uniqueName : drillable.name
  );
  const filters = ifNotEmpty<QueryFilter>(
    query.getParam("filters"),
    stringifyFilter,
    isQueryFilter
  );
  const measures = ifNotEmpty<Measure>(
    query.getParam("measures"),
    (measure) => measure.name
  );
  const properties = ifNotEmpty<QueryProperty>(
    query.getParam("properties"),
    stringifyProperty
  );
  const options = query.getParam("options");

  // Supported params are in
  // https://github.com/tesseract-olap/tesseract/blob/master/tesseract-server/src/handlers/logic_layer/aggregate.rs#L76

  // PENDING IMPLEMENTATION
  // top_where: Option<String>
  // rate: Option<String>

  // UNSUPPORTED
  // captions
  // distinct
  // nonempty

  // Keep in mind the stringify functions between aggregate and logiclayer aren't shared
  // aggregate uses Level#fullName, logiclayer uses Level#uniqueName

  const tesseractQuery = {
    cube: cube.name,
    debug: options.debug,
    drilldowns: drilldowns?.join(","),
    exclude_default_members: options.exclude_default_members,
    filters: filters?.join(","),
    growth: ifValid<QueryGrowth, string>(
      query.getParam("growth"),
      isQueryGrowth,
      (item: QueryGrowth) => `${item.level.uniqueName},${item.measure.name}`
    ),
    limit: ifValid<QueryPagination, string>(
      query.getParam("pagination"),
      isQueryPagination,
      stringifyPagination
    ),
    locale: query.getParam("locale") || undefined,
    measures: measures?.join(","),
    parents: options.parents,
    properties: properties?.join(","),
    rca: ifValid<QueryRCA, string>(
      query.getParam("rca"),
      isQueryRCA,
      (item: QueryRCA) =>
        `${item.level1.uniqueName},${item.level2.uniqueName},${item.measure.name}`
    ),
    sort: ifValid<QuerySorting, string>(
      query.getParam("sorting"),
      isQuerySorting,
      stringifySorting
    ),
    sparse: options.sparse,
    time: ifValid<QueryTimeframe, string>(
      query.getParam("time"),
      isQueryTimeframe,
      (item) => (item.precision ? `${item.precision}.${item.value}` : `${item.value}`)
    ),
    top: ifValid<QueryTopk, string>(
      query.getParam("topk"),
      isQueryTopk,
      (item: QueryTopk) => {
        const calculation = Measure.isMeasure(item.measure)
          ? item.measure.name
          : item.measure;
        return `${item.amount},${item.level.uniqueName},${calculation},${item.order}`;
      }
    )
  };

  query.getParam("cuts").forEach(({ drillable, members }) => {
    const level = Level.isLevel(drillable) ? drillable : undefined;
    if (level) {
      tesseractQuery[level.uniqueName] = members.join(",");
    }
  });

  return tesseractQuery;
}

export function logicLayerQueryParser(
  query: Query,
  params: Partial<TesseractLogicLayerURLSearchParams>
): Query {
  const cube = query.cube;

  const levels: Record<string, Level> = {};
  for (let level of cube.levelIterator) {
    levels[level.uniqueName] = level;
  }

  const exclusions =
    "cube|drilldowns|time|measures|properties|filters|parents|top|top_where|sort|limit|growth|rca|debug|exclude_default_members|locale|distinct|nonempty|sparse|rate";
  Object.keys(params).forEach((key) => {
    const level = levels[key];
    if (level && exclusions.indexOf(key) === -1) {
      query.addCut(level, `${params[key]}`.split(","));
    }
  });

  if (params.drilldowns) {
    params.drilldowns.split(",").forEach((item) => {
      const level = levels[item];
      level && query.addDrilldown(level);
    });
  }

  if (params.limit != null) {
    const limit = `${params.limit}`.split(",");
    const offset = limit.length === 2 ? limit[0] : "0";
    const amount = limit.length === 2 ? limit[1] : limit[0];
    query.setPagination(Number.parseInt(amount, 10), Number.parseInt(offset, 10));
  }

  if (params.locale && params.locale !== "undefined") {
    query.setLocale(params.locale);
  }

  if (params.measures) {
    params.measures.split(",").forEach((item) => {
      const measure = cube.measuresByName[item];
      measure && query.addMeasure(measure);
    });
  }

  if (params.filters) {
    params.filters.split(",").forEach((item) => {
      const index = item.indexOf(".");
      const measureName = item.substr(0, index);
      const measure = CalculationName[measureName] || cube.measuresByName[measureName];
      if (measure) {
        const { constraints, joint } = parseFilterConstraints(item);
        query.addFilter(measure, constraints[0], joint, constraints[1]);
      }
    });
  }

  if (params.growth) {
    const [lvlUniqueName, measureName] = params.growth.split(",");
    const level = levels[lvlUniqueName];
    const measure = cube.measuresByName[measureName];
    level && measure && query.setGrowth(level, measure);
  }

  if (params.properties) {
    params.properties.split(",").forEach((item) => {
      const level = splitFullName(item);
      const property = level.pop();
      property && query.addProperty(joinFullName(level), property);
    });
  }

  if (params.rca) {
    const [lvl1UniqueName, lvl2UniqueName, measureName] = params.rca.split(",");
    const level1 = levels[lvl1UniqueName];
    const level2 = levels[lvl2UniqueName];
    const measure = cube.measuresByName[measureName];
    level1 && level2 && measure && query.setRCA(level1, level2, measure);
  }

  if (params.sort) {
    const orderIndex = params.sort.lastIndexOf(".");
    const sortProperty = params.sort.slice(0, orderIndex);
    const sortOrder = params.sort.slice(orderIndex + 1);
    query.setSorting(sortProperty, sortOrder === "desc" ? "asc" : "desc");
  }

  if (params.time) {
    const [precision, value] = params.time.split(".");
    query.setTime(TimeValue[value], TimePrecision[precision]);
  }

  if (params.top) {
    const [amountRaw, lvlUniqueName, measureName, order] = params.top.split(",");
    const amount = Number.parseInt(amountRaw);
    const level = levels[lvlUniqueName];
    const measure = cube.measuresByName[measureName];
    amount && level && measure && query.setTop(amount, level, measure, Direction[order]);
  }

  const { debug, distinct, exclude_default_members, nonempty, parents, sparse } = params;
  typeof debug === "boolean" && query.setOption("debug", debug);
  typeof distinct === "boolean" && query.setOption("distinct", distinct);
  typeof exclude_default_members === "boolean" &&
    query.setOption("exclude_default_members", exclude_default_members);
  typeof nonempty === "boolean" && query.setOption("nonempty", nonempty);
  typeof parents === "boolean" && query.setOption("parents", parents);
  typeof sparse === "boolean" && query.setOption("sparse", sparse);

  // top_where: string;
  // rate: string;

  return query;
}
