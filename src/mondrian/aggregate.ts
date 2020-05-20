import { Comparison, Direction } from "../enums";
import { ClientError } from "../errors";
import { Drillable, QueryCut, QueryFilter, QueryProperty } from "../interfaces";
import Level from "../level";
import Measure from "../measure";
import { Query } from "../query";
import { ensureArray, ifNotEmpty } from "../utils";
import { MondrianAggregateURLSearchParams } from "./interfaces";
import {
  joinFullName,
  parseCut,
  splitFullName,
  stringifyCut,
  stringifyFilter,
  stringifyProperty
} from "./utils";

export function aggregateQueryBuilder(
  query: Query
): Partial<MondrianAggregateURLSearchParams> {
  const captions = query.getParam("captions");

  const locale = query.getParam("locale").slice(0, 2);
  if (locale) {
    const localeTester = new RegExp(`^${locale}\\s|\\s${locale}$`, "i");
    query.getParam("drilldowns").forEach((dd) => {
      // the future implementation of namedset will require this
      if (Level.isLevel(dd)) {
        const property = dd.properties.find((prop) => localeTester.test(prop.name));
        if (property) {
          captions.push({ level: dd, name: property.name });
        }
      }
    });
  }

  const drilldowns = ifNotEmpty(
    query.getParam("drilldowns"),
    (drillable: Drillable) => drillable.fullName
  );
  const measures = ifNotEmpty(
    query.getParam("measures"),
    (measure: Measure) => measure.name
  );

  if (!drilldowns || !measures) {
    const lost = [!drilldowns && "drilldowns", !measures && "measures"].filter(Boolean);
    throw new ClientError(`Invalid Query: missing ${lost.join(" and ")}`);
  }

  const pagination = query.getParam("pagination");
  const sorting = query.getParam("sorting");
  const options = query.getParam("options");

  return {
    caption: ifNotEmpty<QueryProperty>(captions, stringifyProperty),
    cut: ifNotEmpty<QueryCut>(query.getParam("cuts"), stringifyCut),
    debug: options.debug,
    distinct: options.distinct,
    drilldown: drilldowns,
    filter: ifNotEmpty<QueryFilter>(query.getParam("filters"), stringifyFilter),
    limit: pagination.amount || undefined,
    measures,
    nonempty: options.nonempty,
    offset: pagination.offset || undefined,
    order_desc: sorting.direction === Direction.DESC || undefined,
    order: sorting.property
      ? Measure.isMeasure(sorting.property)
        ? sorting.property.fullName
        : typeof sorting.property === "string"
        ? undefined
        : stringifyProperty(sorting.property)
      : undefined,
    parents: options.parents,
    properties: ifNotEmpty<QueryProperty>(
      query.getParam("properties"),
      stringifyProperty
    ),
    sparse: options.sparse
  };
}

export function aggregateQueryParser(
  query: Query,
  params: Partial<MondrianAggregateURLSearchParams>
): Query {
  const cube = query.cube;

  const levels: Record<string, Level> = {};
  for (let level of cube.levelIterator) {
    levels[level.fullName] = level;
  }

  ensureArray(params.caption).forEach((item) => {
    const propIndex = item.lastIndexOf(".");
    const levelFullName = item.slice(0, propIndex);
    const property = item.slice(propIndex + 1);
    const level = levels[levelFullName];
    level && query.addCaption(level, property);
  });

  ensureArray(params.cut).forEach((item) => {
    const cut = parseCut(item);
    query.addCut(...cut);
  });

  ensureArray(params.drilldown).forEach((item) => {
    const level = levels[item];
    level && query.addDrilldown(level);
  });

  ensureArray(params.filter).forEach((item) => {
    const [, measureName, operator, value] = item.match(/^(.+)\s(>|<|>=|<=|=|<>)\s(.+)$/);
    const measure = cube.measuresByName[measureName];
    const comparison = Comparison[operator];
    measure &&
      comparison &&
      query.addFilter(measure, [comparison, Number.parseFloat(value)]);
  });

  ensureArray(params.measures).forEach((item) => {
    const measure = cube.measuresByName[item];
    measure && query.addMeasure(measure);
  });

  ensureArray(params.properties).forEach((item) => {
    const level = splitFullName(item);
    const property = level.pop();
    property && query.addProperty(joinFullName(level), property);
  });

  if (params.limit != null) {
    query.setPagination(params.limit, params.offset);
  }

  if (params.order) {
    query.setSorting(params.order, !!params.order_desc);
  }

  typeof params.debug === "boolean" && query.setOption("debug", params.debug);
  typeof params.distinct === "boolean" && query.setOption("distinct", params.distinct);
  typeof params.nonempty === "boolean" && query.setOption("nonempty", params.nonempty);
  typeof params.parents === "boolean" && query.setOption("parents", params.parents);
  typeof params.sparse === "boolean" && query.setOption("sparse", params.sparse);

  return query;
}
