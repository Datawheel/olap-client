import { Comparison, Direction } from "../interfaces/enums";
import { Level } from "../level";
import { Measure } from "../measure";
import { Property } from "../property";
import { Drillable, Query, QueryCut, QueryFilter } from "../query";
import { asArray } from "../toolbox/collection";
import { ifNotEmpty } from "../toolbox/validation";
import { MondrianAggregateURLSearchParams } from "./interfaces";
import { parseCut, splitPropertyName, stringifyCut, stringifyFilter } from "./utils";

export function extractAggregateSearchParamsFromQuery(
  query: Query
): Partial<MondrianAggregateURLSearchParams> {
  const captions = query.getParam("captions");
  const pagination = query.getParam("pagination");
  const sorting = query.getParam("sorting");
  const options = query.getParam("options");

  const locale = query.getParam("locale").slice(0, 2);
  if (locale) {
    const localeTester = new RegExp(`^${locale}\\s|\\s${locale}$`, "i");
    query.getParam("drilldowns").forEach((dd) => {
      // the future implementation of namedset will require this
      if (Level.isLevel(dd)) {
        const property = dd.properties.find((prop) => localeTester.test(prop.name));
        property && captions.push(property);
      }
    });
  }

  return {
    caption:
         ifNotEmpty<Property>(captions, stringifyProperty),
    cut:
         ifNotEmpty<QueryCut>(query.getParam("cuts"), stringifyCut),
    drilldown:
        ifNotEmpty<Drillable>(query.getParam("drilldowns"), item => item.fullName),
    filter:
      ifNotEmpty<QueryFilter>(query.getParam("filters"), stringifyFilter),
    measures:
          ifNotEmpty<Measure>(query.getParam("measures"), item => item.name),
    properties:
         ifNotEmpty<Property>(query.getParam("properties"), stringifyProperty),

    limit: pagination.limit || undefined,
    offset: pagination.offset || undefined,
    // prettier-ignore
    order:
      Measure.isMeasure(sorting.property)   ? sorting.property.fullName :
      Property.isProperty(sorting.property) ? stringifyProperty(sorting.property) :
      /* else */                              undefined,
    order_desc: sorting.direction === Direction.DESC || undefined,

    debug: options.debug,
    distinct: options.distinct,
    nonempty: options.nonempty,
    parents: options.parents,
    sparse: options.sparse
  };

  function stringifyProperty(item: Property): string {
    return `${item.level.fullName}.${item.name}`;
  }
}

export function hydrateQueryFromAggregateSearchParams(
  query: Query,
  params: Partial<MondrianAggregateURLSearchParams>
): Query {
  const cube = query.cube;

  const levels: Record<string, Level> = {};
  for (let level of cube.levelIterator) {
    levels[level.fullName] = level;
  }

  asArray(params.caption).forEach((item) => {
    const [levelFullName, propName] = splitPropertyName(item);
    const level = levels[levelFullName];
    const property = level && level.propertiesByName[propName];
    property && query.addCaption(property);
  });

  asArray(params.cut).forEach((item) => {
    const cut = parseCut(item);
    query.addCut(...cut);
  });

  asArray(params.drilldown).forEach((item) => {
    const level = levels[item];
    level && query.addDrilldown(level);
  });

  asArray(params.filter).forEach((item) => {
    const [, measureName, operator, value] = item.match(/^(.+)\s(>|<|>=|<=|=|<>)\s(.+)$/) || [];
    const measure = cube.measuresByName[measureName];
    const comparison = Comparison[operator];
    measure && comparison &&
      query.addFilter(measure, [comparison, Number.parseFloat(value)]);
  });

  asArray(params.measures).forEach((item) => {
    const measure = cube.measuresByName[item];
    measure && query.addMeasure(measure);
  });

  asArray(params.properties).forEach((item) => {
    const [levelFullName, propName] = splitPropertyName(item);
    const level = levels[levelFullName];
    const property = level && level.propertiesByName[propName];
    property && query.addProperty(property);
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
