import {Comparison, Order} from "../enums";
import {ClientError} from "../errors";
import Level from "../level";
import Measure from "../measure";
import {
  Drillable,
  Query,
  QueryFilter,
  QueryGrowth,
  QueryProperty,
  QueryRCA,
  QueryTopk
} from "../query";
import {ensureArray, undefinedHelpers} from "../utils";
import {TesseractAggregateURLSearchParams} from "./interfaces";
import {joinFullName, parseCut, stringifyCut} from "./utils";

export function aggregateQueryBuilder(
  query: Query
): Partial<TesseractAggregateURLSearchParams> {
  const {
    undefinedIfEmpty,
    undefinedIfIncomplete,
    undefinedIfKeyless,
    undefinedIfZero
  } = undefinedHelpers();

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

  const sortOrder = query.getParam("orderDescendent") ? "desc" : "asc";
  const sort = query.getParam("orderProperty")
    ? `${query.getParam("orderProperty")}.${sortOrder}`
    : undefined;

  const options = query.getParam("options");
  return {
    captions: undefinedIfEmpty(captions),
    cuts: undefinedIfKeyless(query.getParam("cuts"), stringifyCut),
    debug: options.debug ? true : undefined,
    drilldowns,
    exclude_default_members: undefined,
    filters: undefinedIfEmpty(
      query.getParam("filters"),
      (f: QueryFilter) => `${f.measure.name} ${f.comparison} ${f.value}`
    ),
    growth: undefinedIfIncomplete(
      query.getParam("growth"),
      (g: Required<QueryGrowth>) => `${g.level.fullName},${g.measure.name}`
    ),
    limit: undefinedIfZero(query.getParam("limit")),
    measures,
    parents: Boolean(options.parents),
    properties: undefinedIfEmpty(query.getParam("properties"), (p: QueryProperty) =>
      joinFullName([p.level.dimension.name, p.level.hierarchy.name, p.level.name, p.name])
    ),
    rate: undefined,
    rca: undefinedIfIncomplete(
      query.getParam("rca"),
      (r: Required<QueryRCA>) =>
        `${r.level1.fullName},${r.level2.fullName},${r.measure.name}`
    ),
    sort,
    sparse: Boolean(options.sparse),
    top_where: undefined,
    top: undefinedIfIncomplete(
      query.getParam("topk"),
      (t: Required<QueryTopk>) =>
        `${t.amount},${t.level.fullName},${t.measure.name},${t.order}`
    )
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
    const cut = parseCut(item);
    query.addCut(...cut);
  });

  ensureArray(params.drilldowns).forEach(item => {
    const level = levels[item];
    level && query.addDrilldown(level);
  });

  ensureArray(params.filters).forEach(item => {
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

  if (params.growth) {
    const [levelFullName, measureName] = params.growth.split(",");
    const level = levels[levelFullName];
    const measure = cube.measuresByName[measureName];
    level && measure && query.setGrowth(level, measure);
  }

  if (params.rca) {
    const [level1FullName, level2FullName, measureName] = params.rca.split(",");
    const level1 = levels[level1FullName];
    const level2 = levels[level2FullName];
    const measure = cube.measuresByName[measureName];
    level1 && level2 && measure && query.setRCA(level1, level2, measure);
  }

  if (params.top) {
    const [amountRaw, levelFullName, measureName, order] = params.top.split(",");
    const amount = Number.parseInt(amountRaw);
    const level = levels[levelFullName];
    const measure = cube.measuresByName[measureName];
    amount && level && measure && query.setTop(amount, level, measure, Order[order]);
  }

  if (params.limit != null) {
    query.setPagination(params.limit);
  }

  if (params.sort) {
    query.setSorting(params.sort, true);
  }

  typeof params.debug === "boolean" && query.setOption("debug", params.debug);
  typeof params.distinct === "boolean" && query.setOption("distinct", params.distinct);
  typeof params.nonempty === "boolean" && query.setOption("nonempty", params.nonempty);
  typeof params.parents === "boolean" && query.setOption("parents", params.parents);
  typeof params.sparse === "boolean" && query.setOption("sparse", params.sparse);

  // exclude_default_members: boolean;
  // rate:       string;
  // top_where:  string;

  return query;
}
