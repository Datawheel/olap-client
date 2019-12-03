import {Comparison} from "../enums";
import {ClientError} from "../errors";
import Level from "../level";
import Measure from "../measure";
import {Drillable, Query, QueryFilter, QueryProperty} from "../query";
import {ensureArray, undefinedHelpers} from "../utils";
import {MondrianAggregateURLSearchParams} from "./interfaces";
import {joinFullName, parseCut, stringifyCut} from "./utils";

export function aggregateQueryBuilder(query: Query): MondrianAggregateURLSearchParams {
  const {undefinedIfEmpty, undefinedIfKeyless, undefinedIfZero} = undefinedHelpers();

  const captions = query.getParam("captions");

  const locale = query.getParam("locale").slice(0, 2);
  if (locale) {
    const localeTester = new RegExp(`^${locale}\\s|\\s${locale}$`, "i");
    query.getParam("drilldowns").forEach(dd => {
      // the future implementation of namedset will require this
      if (Level.isLevel(dd)) {
        const localeProp = dd.properties.find(prop => localeTester.test(prop.name));
        if (localeProp) {
          captions.push(dd.fullName.concat(".", localeProp.name));
        }
      }
    });
  }

  const drilldowns = undefinedIfEmpty(
    query.getParam("drilldowns"),
    (d: Drillable) => d.fullName
  );
  const measures = undefinedIfEmpty(query.getParam("measures"), (m: Measure) => m.name);

  if (!drilldowns || !measures) {
    const lost = [!drilldowns && "drilldowns", !measures && "measures"].filter(Boolean);
    throw new ClientError(`Invalid Query: missing ${lost.join(" and ")}`);
  }

  const orderParam = query.getParam("orderProperty");

  const options = query.getParam("options");
  return {
    caption: undefinedIfEmpty(captions),
    cut: undefinedIfKeyless(query.getParam("cuts"), stringifyCut),
    debug: options.debug,
    distinct: options.distinct,
    drilldown: drilldowns,
    filter: undefinedIfEmpty(
      query.getParam("filters"),
      (f: QueryFilter) => `${f.measure.name} ${f.comparison} ${f.value}`
    ),
    limit: undefinedIfZero(query.getParam("limit")),
    measures,
    nonempty: options.nonempty,
    offset: undefinedIfZero(query.getParam("offset")),
    order_desc: query.getParam("orderDescendent") ? true : undefined,
    order: orderParam
      ? orderParam.indexOf(".") > -1 ? orderParam : joinFullName(["Measures", orderParam])
      : undefined,
    parents: options.parents,
    properties: undefinedIfEmpty(
      query.getParam("properties"),
      (p: QueryProperty) => `${p.level.fullName}.${p.name}`
    ),
    sparse: options.sparse
  };
}

export function aggregateQueryParser(
  query: Query,
  params: MondrianAggregateURLSearchParams
): Query {
  const cube = query.cube;

  const levels: Record<string, Level> = {};
  for (let level of cube.levelIterator) {
    levels[level.fullName] = level;
  }

  ensureArray(params.caption).forEach(item => {
    const propIndex = item.lastIndexOf(".");
    const levelFullName = item.slice(0, propIndex);
    const property = item.slice(propIndex + 1);
    const level = levels[levelFullName];
    level && query.addCaption(level, property);
  });

  ensureArray(params.cut).forEach(item => {
    const cut = parseCut(item);
    query.addCut(...cut);
  });

  ensureArray(params.drilldown).forEach(item => {
    const level = levels[item];
    level && query.addDrilldown(level);
  });

  ensureArray(params.filter).forEach(item => {
    const [measureName, operator, value] = item.split(" ");
    const comparison = Comparison[operator];
    const measure = cube.measuresByName[measureName];
    measure && query.addFilter(measure, comparison, Number.parseFloat(value));
  });

  ensureArray(params.measures).forEach(item => {
    const measure = cube.measuresByName[item];
    measure && query.addMeasure(measure);
  });

  // TODO
  // ensureArray(params.properties).forEach(item => {});

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
