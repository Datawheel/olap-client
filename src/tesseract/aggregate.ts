import { CalculationName, Direction } from "../enums";
import { ClientError } from "../errors";
import {
  Drillable,
  QueryCut,
  QueryFilter,
  QueryGrowth,
  QueryProperty,
  QueryRCA,
  QueryTopk
} from "../interfaces";
import Level from "../level";
import Measure from "../measure";
import { Query } from "../query";
import {
  ensureArray,
  ifNotEmpty,
  ifValid,
  isQueryGrowth,
  isQueryRCA,
  isQueryTopk
} from "../utils";
import { TesseractAggregateURLSearchParams } from "./interfaces";
import {
  joinFullName,
  parseCut,
  parseFilterConstraints,
  splitFullName,
  stringifyCut,
  stringifyFilter,
  stringifyProperty,
  stringifySorting
} from "./utils";

export function aggregateQueryBuilder(
  query: Query
): Partial<TesseractAggregateURLSearchParams> {
  const captions = query.getParam("captions");

  const locale = query.getParam("locale").slice(0, 2);
  if (locale) {
    const localeTester = new RegExp(`^${locale}\\s|\\s${locale}$`, "i");
    query.getParam("drilldowns").forEach(dd => {
      if (Level.isLevel(dd)) {
        const property = dd.properties.find(prop => localeTester.test(prop.name));
        if (property) {
          captions.push({ level: dd, name: property.name });
        }
      }
      // TODO: implement namedset
    });
  }

  const drilldowns = ifNotEmpty<Drillable>(query.getParam("drilldowns"), d =>
    Level.isLevel(d) ? d.fullName : d.name
  );
  const measures = ifNotEmpty<Measure>(query.getParam("measures"), m => m.name);

  if (!drilldowns || !measures) {
    const lost = [!drilldowns && "drilldowns", !measures && "measures"].filter(Boolean);
    throw new ClientError(`Invalid Query: missing ${lost.join(" and ")}`);
  }

  const pagination = query.getParam("pagination");
  const sorting = query.getParam("sorting");
  const options = query.getParam("options");

  // Supported params are in
  // https://github.com/tesseract-olap/tesseract/blob/master/tesseract-server/src/handlers/aggregate.rs#L131

  // PENDING IMPLEMENTATION
  // top_where: Option<String>
  // rate: Option<String>

  // UNSUPPORTED
  // distinct
  // nonempty

  // Keep in mind the stringify functions between aggregate and logiclayer aren't shared
  // aggregate uses Level#fullName, logiclayer uses Level#uniqueName

  return {
    captions: ifNotEmpty<QueryProperty>(captions, stringifyProperty),
    cuts: ifNotEmpty<QueryCut>(query.getParam("cuts"), stringifyCut),
    debug: options.debug ? true : undefined,
    drilldowns,
    exclude_default_members: options.exclude_default_members,
    filters: ifNotEmpty<QueryFilter>(query.getParam("filters"), stringifyFilter),
    growth: ifValid<QueryGrowth, string>(
      query.getParam("growth"),
      isQueryGrowth,
      (item: QueryGrowth) => `${item.level.fullName},${item.measure.name}`
    ),
    limit: pagination.amount || undefined,
    measures,
    parents: options.parents,
    properties: ifNotEmpty<QueryProperty>(
      query.getParam("properties"),
      stringifyProperty
    ),
    rate: undefined,
    rca: ifValid<QueryRCA, string>(
      query.getParam("rca"),
      isQueryRCA,
      (item: QueryRCA) =>
        `${item.level1.fullName},${item.level2.fullName},${item.measure.name}`
    ),
    sort: sorting.property ? stringifySorting(sorting) : undefined,
    sparse: options.sparse,
    top_where: undefined,
    top: ifValid<QueryTopk, string>(query.getParam("topk"), isQueryTopk, item => {
      const calculation = Measure.isMeasure(item.measure)
        ? item.measure.name
        : item.measure;
      return `${item.amount},${item.level.fullName},${calculation},${item.order}`;
    })
  };
}

export function aggregateQueryParser(
  query: Query,
  params: Partial<TesseractAggregateURLSearchParams>
): Query {
  const cube = query.cube;

  const levels: Record<string, Level> = {};
  for (let level of cube.levelIterator) {
    levels[level.fullName] = level;
  }

  ensureArray(params.captions).forEach(item => {
    const propIndex = item.lastIndexOf(".");
    const levelFullName = item.slice(0, propIndex);
    const property = item.slice(propIndex + 1);
    const level = levels[levelFullName];
    level && query.addCaption(level, property);
  });

  ensureArray(params.cuts).forEach(item => {
    const [levelName, members] = parseCut(item);
    const level = levels[levelName];
    level && query.addCut(level, members);
  });

  ensureArray(params.drilldowns).forEach(item => {
    const level = levels[item];
    level && query.addDrilldown(level);
  });

  ensureArray(params.filters).forEach(item => {
    const index = item.indexOf(".");
    const measureName = item.substr(0, index);
    const measure = CalculationName[measureName] || cube.measuresByName[measureName];
    if (measure) {
      const { constraints, joint } = parseFilterConstraints(item);
      query.addFilter(measure, constraints[0], joint, constraints[1]);
    }
  });

  ensureArray(params.measures).forEach(item => {
    const measure = cube.measuresByName[item];
    measure && query.addMeasure(measure);
  });

  ensureArray(params.properties).forEach(item => {
    const level = splitFullName(item);
    const property = level.pop();
    property && query.addProperty(joinFullName(level), property);
  });

  if (params.growth) {
    const [lvlFullName, measureName] = params.growth.split(",");
    const level = levels[lvlFullName];
    const measure = cube.measuresByName[measureName];
    level && measure && query.setGrowth(level, measure);
  }

  if (params.rca) {
    const [lvl1FullName, lvl2FullName, measureName] = params.rca.split(",");
    const level1 = levels[lvl1FullName];
    const level2 = levels[lvl2FullName];
    const measure = cube.measuresByName[measureName];
    level1 && level2 && measure && query.setRCA(level1, level2, measure);
  }

  if (params.top) {
    const [amountRaw, lvlFullName, calculationName, order] = params.top.split(",");
    const amount = Number.parseInt(amountRaw);
    const level = levels[lvlFullName];
    const calculation =
      CalculationName[calculationName] || cube.measuresByName[calculationName];
    amount &&
      level &&
      calculation &&
      query.setTop(amount, level, calculation, Direction[order] || Direction.DESC);
  }

  if (params.limit != null) {
    query.setPagination(params.limit);
  }

  if (params.sort) {
    const index = params.sort.lastIndexOf(".");
    const sortProperty = params.sort.slice(0, index);
    const sortOrder = params.sort.slice(index + 1);
    const calculation =
      CalculationName[sortProperty] || cube.measuresByName[sortProperty];
    calculation && query.setSorting(calculation, Direction[sortOrder] || Direction.DESC);
  }

  const { debug, distinct, exclude_default_members, nonempty, parents, sparse } = params;
  typeof debug === "boolean" && query.setOption("debug", debug);
  typeof distinct === "boolean" && query.setOption("distinct", distinct);
  typeof exclude_default_members === "boolean" &&
    query.setOption("exclude_default_members", exclude_default_members);
  typeof nonempty === "boolean" && query.setOption("nonempty", nonempty);
  typeof parents === "boolean" && query.setOption("parents", parents);
  typeof sparse === "boolean" && query.setOption("sparse", sparse);

  // rate:       string;
  // top_where:  string;

  return query;
}
