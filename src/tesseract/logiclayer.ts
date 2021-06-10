import { QueryDescriptor } from "../interfaces/descriptors";
import { Calculation, Direction, TimePrecision, TimeValue, TimeValuePoint } from "../interfaces/enums";
import { Level } from "../level";
import { Measure } from "../measure";
import { Property } from "../property";
import { Drillable, Query, QueryCalcGrowth, QueryCalcRca, QueryCalcTopk, QueryCut, QueryFilter } from "../query";
import { filterMap } from "../toolbox/collection";
import { hydrateQueryFromJSON } from "../toolbox/query";
import { isNumeric } from "../toolbox/validation";
import { TesseractLogicLayerURLSearchParams } from "./interfaces";
import { parseFilterConstraints, stringifyFilter } from "./utils";

export function extractLogicLayerSearchParamsFromQuery(
  query: Query
): Partial<TesseractLogicLayerURLSearchParams> {
  const cube = query.cube;

  const drilldowns = filterMap<Drillable, string>(
    query.getParam("drilldowns"),
    item => Level.isLevel(item) ? item.uniqueName : null
  );
  const filters = filterMap<QueryFilter, string>(
    query.getParam("filters"),
    stringifyFilter
  );
  const measures = filterMap<Measure, string>(
    query.getParam("measures"),
    item => item.name
  );
  const properties = filterMap<Property, string>(
    query.getParam("properties"),
    item => item.uniqueName
  );
  const options = query.getParam("options");
  const pagination = query.getParam("pagination");
  const sorting = query.getParam("sorting");
  const timeframe = query.getParam("time");

  // Supported params are described in
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

  const calculations = query.getParam("calculations").reverse();
  const growth = calculations.find(calc => calc.kind === "growth") as QueryCalcGrowth | undefined;
  const rca = calculations.find(calc => calc.kind === "rca") as QueryCalcRca | undefined;
  const topk = calculations.find(calc => calc.kind === "topk") as QueryCalcTopk | undefined;

  const tesseractQuery: Partial<TesseractLogicLayerURLSearchParams> = {
    cube: cube.name,
    locale: query.getParam("locale") || undefined,
    drilldowns: drilldowns.join(",") || undefined,
    properties: properties.join(",") || undefined,
    measures: measures.join(",") || undefined,
    filters: filters.join(",") || undefined,

    // prettier-ignore
    limit:
      !pagination.limit     ? undefined :
      pagination.offset > 0 ? `${pagination.offset},${pagination.limit}` :
      /* else */              `${pagination.limit}`,

    // prettier-ignore
    sort:
      Measure.isMeasure(sorting.property)   ? `${sorting.property.name}.${sorting.direction}` :
      typeof sorting.property === "string"  ? `${sorting.property}.${sorting.direction}` :
      /* else */                              undefined,

    // prettier-ignore
    time: timeframe.precision != null && timeframe.value != null
      ? `${timeframe.precision}.${timeframe.value}`
      : undefined,

    // booleans
    debug: options.debug,
    exclude_default_members: options.exclude_default_members,
    parents: options.parents,
    sparse: options.sparse,

    // calculations
    growth: growth && `${growth.category.uniqueName},${growth.value.name}`,
    rca: rca && `${rca.location.uniqueName},${rca.category.uniqueName},${rca.value.name}`,
    top: topk && (topk => {
      const calculation = Measure.isMeasure(topk.value) ? topk.value.name : topk.value;
      return `${topk.amount},${topk.category.uniqueName},${calculation},${topk.order}`;
    })(topk),
  };

  const excluded_cuts = filterMap<QueryCut, string>(
    query.getParam("cuts"),
    (item: QueryCut) => {
      const { drillable } = item;
      const level = Level.isLevel(drillable) ? drillable : undefined;
      if (!level) return null;
      if (!item.isExclusive) {
        tesseractQuery[level.uniqueName] = item.members.join(",");
        return null;
      }
      return `${level.uniqueName}:${item.members.join(",")}`;
    }
  );
  tesseractQuery.exclude = excluded_cuts.join(";") || undefined;

  return tesseractQuery;
}

export function hydrateQueryFromLogicLayerSearchParams(
  query: Query,
  params: Partial<TesseractLogicLayerURLSearchParams>
): Query {
  const cube = query.cube;

  const levels: Record<string, Level> = {};
  for (let level of cube.levelIterator) {
    levels[level.uniqueName] = level;
  }

  const props: Record<string, Property> = {};
  for (let prop of cube.propertyIterator) {
    props[prop.uniqueName] = prop;
  }

  const exclusions = [
    "cube",
    "drilldowns",
    "time",
    "measures",
    "properties",
    "filters",
    "parents",
    "top",
    "sort",
    "limit",
    "growth",
    "rca",
    "rate",
    "top_where",
    "debug",
    "exclude",
    "exclude_default_members",
    "locale",
    "distinct",
    "nonempty",
    "sparse",
  ];

  const { drilldowns = "", measures = "", exclude = "", filters = "", properties = "" } = params;

  Object.keys(params).forEach(key => {
    const level = levels[key];
    level && exclusions.indexOf(key) === -1 &&
      query.addCut(level, `${params[key]}`.split(","));
  });

  exclude.split(";").forEach(item => {
    const [key, members] = item.split(":");
    const level = levels[key];
    level && query.addCut(level, members.split(","), {exclusive: true});
  });

  drilldowns.split(",").forEach(item => {
    const level = levels[item];
    level && query.addDrilldown(level);
  });

  filters.split(",").forEach(item => {
    const measureName = item.substr(0, item.indexOf("."));
    const measure = Calculation[measureName] || cube.measuresByName[measureName];
    if (measure) {
      const { constraints: [constraint, constraint2], joint } = parseFilterConstraints(item);
      query.addFilter(measure, constraint, joint, constraint2);
    }
  });

  measures.split(",").forEach(item => {
    const measure = cube.measuresByName[item];
    measure && query.addMeasure(measure);
  });

  properties.split(",").forEach(item => {
    const property = props[item];
    property && query.addProperty(property);
  });

  const json: Partial<QueryDescriptor> = {
    cube: params.cube,
    locale: params.locale || "",
    options: {
      debug: params.debug,
      exclude_default_members: params.exclude_default_members,
      parents: params.parents,
      sparse: params.sparse,
    },
    page_limit: 0,
    page_offset: 0,
    sort_direction: Direction.DESC,
    sort_property: "",
    time: undefined,
  };

  if (params.growth) {
    const [lvlUniqueName, measureName] = params.growth.split(",");
    const level = levels[lvlUniqueName];
    const measure = cube.measuresByName[measureName];
    level && measure && query.addCalculation("growth", {
      category: level,
      value: measure,
    });
  }

  if (params.rca) {
    const [lvl1UniqueName, lvl2UniqueName, measureName] = params.rca.split(",");
    const level1 = levels[lvl1UniqueName];
    const level2 = levels[lvl2UniqueName];
    const measure = cube.measuresByName[measureName];
    level1 && level2 && measure && query.addCalculation("rca", {
      category: level1,
      location: level2,
      value: measure,
    });
  }

  if (params.top) {
    const [amountRaw, lvlUniqueName, measureName, order] = params.top.split(",");
    const amount = Number.parseInt(amountRaw);
    const level = levels[lvlUniqueName];
    const measure = cube.measuresByName[measureName];
    amount && level && measure && query.addCalculation("topk", {
      amount,
      category: level,
      order: Direction[order] || Direction.DESC,
      value: measure,
    });
  }

  if (params.limit) {
    const pagination = filterMap<string, number>(
      params.limit.split(","),
      item => Number.parseInt(item) || null
    );
    json.page_limit = pagination.length === 2 ? pagination[1] : pagination[0];
    json.page_offset = pagination.length === 2 ? pagination[0] : 0;
  }

  if (params.sort) {
    const orderIndex = params.sort.lastIndexOf(".");
    json.sort_property = params.sort.slice(0, orderIndex);
    json.sort_direction = Direction[params.sort.slice(orderIndex + 1)];
  }

  if (params.time) {
    const period = filterMap(params.time.split("."), item => item || null);
    const precision: TimePrecision | undefined = TimePrecision[period[0]];
    const value: TimeValuePoint | undefined = isNumeric(period[1]) ? period[1] : TimeValue[period[1]];
    if (precision && value != null) {
      query.setTime(precision, value);
    }
  }

  // top_where: string;
  // rate: string;

  return hydrateQueryFromJSON(query, json);
}
