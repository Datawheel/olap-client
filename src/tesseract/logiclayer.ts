import {Order} from "../enums";
import Level from "../level";
import Measure from "../measure";
import {Drillable, Query, QueryGrowth, QueryRCA, QueryTopk} from "../query";
import {undefinedHelpers} from "../utils";
import {TesseractLogicLayerURLSearchParams} from "./interfaces";

export function logicLayerQueryBuilder(
  query: Query
): Record<string, string[] | string | number | boolean | undefined> {
  const {undefinedIfEmpty, undefinedIfIncomplete} = undefinedHelpers();

  const cube = query.cube;
  const options = query.getParam("options");
  const drilldowns = undefinedIfEmpty(
    query.getParam("drilldowns"),
    (d: Drillable) => (Level.isLevel(d) ? d.uniqueName : d.name)
  );
  const measures = undefinedIfEmpty(query.getParam("measures"), (m: Measure) => m.name);

  const sortOrder = query.getParam("orderDescendent") ? "desc" : "asc";
  const sort = query.getParam("orderProperty")
    ? `${query.getParam("orderProperty")}.${sortOrder}`
    : undefined;

  const tesseractQuery = {
    cube: cube.name,
    debug: options.debug ? true : undefined,
    drilldowns: drilldowns ? drilldowns.join(",") : undefined,
    locale: query.getParam("locale"),
    measures: measures ? measures.join(",") : undefined,
    parents: options.parents,
    sparse: options.sparse,
    sort,
    growth: undefinedIfIncomplete(query.getParam("growth"), (g: Required<QueryGrowth>) =>
      [g.level.uniqueName, g.measure.name].join(",")
    ),
    rca: undefinedIfIncomplete(query.getParam("rca"), (r: Required<QueryRCA>) =>
      [r.level1.uniqueName, r.level2.uniqueName, r.measure.name].join(",")
    ),
    top: undefinedIfIncomplete(query.getParam("topk"), (t: Required<QueryTopk>) =>
      [t.amount, t.level.uniqueName, t.measure.name, t.order].join(",")
    )
  };

  const cuts = query.getParam("cuts");
  for (let level of cube.levelIterator) {
    const cutKey = level.fullName;
    if (cuts.hasOwnProperty(cutKey)) {
      tesseractQuery[level.uniqueName] = cuts[cutKey].join(",");
    }
  }

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
  Object.keys(params).forEach(key => {
    const level = levels[key];
    if (level && exclusions.indexOf(key) === -1) {
      query.addCut(level, `${params[key]}`.split(","));
    }
  });

  if (params.drilldowns) {
    params.drilldowns.split(",").forEach(item => {
      const level = levels[item];
      level && query.addDrilldown(level);
    });
  }

  if (params.measures) {
    params.measures.split(",").forEach(item => {
      const measure = cube.measuresByName[item];
      measure && query.addMeasure(measure);
    });
  }

  // TODO
  // if (params.filters) {
  //   params.filters.split(",").forEach(item => {});
  // }

  // TODO
  // time: string;

  // TODO
  // properties: string;

  if (params.growth) {
    const [levelUniqueName, measureName] = params.growth.split(",");
    const level = levels[levelUniqueName];
    const measure = cube.measuresByName[measureName];
    level && measure && query.setGrowth(level, measure);
  }

  if (params.rca) {
    const [level1UniqueName, level2UniqueName, measureName] = params.rca.split(",");
    const level1 = levels[level1UniqueName];
    const level2 = levels[level2UniqueName];
    const measure = cube.measuresByName[measureName];
    level1 && level2 && measure && query.setRCA(level1, level2, measure);
  }

  if (params.top) {
    const [amountRaw, levelUniqueName, measureName, order] = params.top.split(",");
    const amount = Number.parseInt(amountRaw);
    const level = levels[levelUniqueName];
    const measure = cube.measuresByName[measureName];
    amount && level && measure && query.setTop(amount, level, measure, Order[order]);
  }

  if (params.limit != null) {
    const limit = Number.parseInt(params.limit);
    limit && query.setPagination(limit);
  }

  if (params.locale && params.locale !== "undefined") {
    query.setLocale(params.locale);
  }

  if (params.sort) {
    query.setSorting(params.sort, true);
  }

  typeof params.parents === "boolean" && query.setOption("parents", params.parents);
  typeof params.debug === "boolean" && query.setOption("debug", params.debug);
  typeof params.distinct === "boolean" && query.setOption("distinct", params.distinct);
  typeof params.nonempty === "boolean" && query.setOption("nonempty", params.nonempty);
  typeof params.sparse === "boolean" && query.setOption("sparse", params.sparse);

  // exclude_default_members: boolean;
  // top_where: string;
  // rate: string;

  return query;
}
