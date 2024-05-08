import type {Cube} from "../cube";
import type {
  CalculationDescriptor,
  CutDescriptor,
  LevelDescriptor,
  QueryDescriptor,
} from "../interfaces/descriptors";
import {
  Calculation,
  Comparison,
  Direction,
  Format,
  TimePrecision,
  TimeValue,
} from "../interfaces/enums";
import {Level, type LevelReference} from "../level";
import {type CalcOrMeasure, Measure} from "../measure";
import {Property} from "../property";
import type {
  Drillable,
  Query,
  QueryCalc,
  QueryCalcGrowth,
  QueryCalcRca,
  QueryCalcTopk,
  QueryCut,
  QueryFilter,
} from "../query";
import {filterMap, forEach} from "./collection";
import {isNumeric} from "./validation";

export const calculationBuilders = {
  [Calculation.GROWTH]: buildGrowthCalculation,
  [Calculation.RATE]: buildRateCalculation,
  [Calculation.RCA]: buildRcaCalculation,
  [Calculation.TOPK]: buildTopkCalculation,
};

/**
 * Generates a Growth calculation struct for representation in the Query
 * @param cube The cube where the information comes from
 * @param params The parameters required for the struct
 */
export function buildGrowthCalculation(
  cube: Cube,
  params: {category: LevelReference; value: string | Measure},
): QueryCalcGrowth {
  return {
    kind: "growth",
    category: cube.getLevel(params.category as LevelReference),
    value: cube.getMeasure(params.value as string | Measure),
  };
}

/**
 * Generates a Rate calculation struct for representation in the Query
 * @param cube The cube where the information comes from
 * @param params The parameters required for the struct
 */
export function buildRateCalculation(cube: Cube, params: any) {
  throw new Error("Not implemented");
}

/**
 * Generates a RCA calculation struct for representation in the Query
 * @param cube The cube where the information comes from
 * @param params The parameters required for the struct
 */
export function buildRcaCalculation(
  cube: Cube,
  params: {
    location: LevelReference;
    category: LevelReference;
    value: string | Measure;
  },
): QueryCalcRca {
  return {
    kind: "rca",
    location: cube.getLevel(params.location),
    category: cube.getLevel(params.category),
    value: cube.getMeasure(params.value),
  };
}

/**
 * Generates a TopK calculation struct for representation in the Query
 * @param cube The cube where the information comes from
 * @param params The parameters required for the struct
 */
export function buildTopkCalculation(
  cube: Cube,
  params: {
    amount: number;
    category: LevelReference;
    value: string | CalcOrMeasure;
    order?: string;
  },
): QueryCalcTopk {
  if (!isNumeric(params.amount)) {
    throw new TypeError(`Invalid value in argument amount: ${params.amount}`);
  }
  return {
    kind: "topk",
    amount: params.amount,
    category: cube.getLevel(params.category),
    value:
      Calculation[params.value as Calculation] ||
      cube.getMeasure(params.value as string | Measure),
    order: Direction[params.order as Direction] || Direction.desc,
  };
}

export function skimDescriptor<T extends {cube?: string; server?: string}>(
  descriptor: T,
): T {
  // biome-ignore lint/performance/noDelete: <explanation>
  delete descriptor.cube;
  // biome-ignore lint/performance/noDelete: <explanation>
  delete descriptor.server;
  return descriptor;
}

export function describeCalculation(item: QueryCalc): CalculationDescriptor {
  const entries = Object.entries(item).map(([key, value]) => [
    key,
    Measure.isMeasure(value)
      ? value.name
      : Level.isLevel(value)
        ? skimDescriptor(value.descriptor)
        : value,
  ]);
  return Object.fromEntries(entries);
}

/**
 * Takes the information about a query from a plain object, and adds it to a query object.
 * The function applies the changes in place, and returns the same query passed as parameter.
 *
 * @param query The target query object
 * @param json A plain object with information to inject into the query
 */
export function hydrateQueryFromJSON<T extends Query>(
  query: T,
  json: Partial<QueryDescriptor>,
): T {
  const cube = query.cube;

  if (json.server && json.server !== cube.server) {
    throw new Error(
      `Server "${json.server}" doesn't match with target Query object's server "${cube.server}"`,
    );
  }
  if (json.cube && json.cube !== cube.name) {
    throw new Error(
      `Cube "${json.cube}" doesn't match with target Query object's cube "${cube.name}"`,
    );
  }

  typeof json.format === "string" && query.setFormat(Format[json.format as Format]);

  typeof json.locale === "string" && query.setLocale(json.locale);

  Array.isArray(json.calculations) &&
    json.calculations.forEach((item) => {
      item.kind === "growth" && query.addCalculation(item.kind, item);
      item.kind === "rca" && query.addCalculation(item.kind, item);
      item.kind === "topk" && query.addCalculation(item.kind, item);
    });

  Array.isArray(json.captions) && json.captions.forEach((item) => query.addCaption(item));

  Array.isArray(json.drilldowns) &&
    json.drilldowns.forEach((item) => query.addDrilldown(item));

  Array.isArray(json.cuts) &&
    json.cuts.forEach((item) =>
      query.addCut(item, item.members, {
        exclusive: item.exclusive,
        forMatch: item.for_match,
      }),
    );

  Array.isArray(json.filters) &&
    json.filters.forEach((item) =>
      query.addFilter(item.measure, item.constraint, item.joint, item.constraint2),
    );

  Array.isArray(json.measures) && json.measures.forEach((item) => query.addMeasure(item));

  Array.isArray(json.properties) &&
    json.properties.forEach((item) => query.addProperty(item));

  if (json.page_limit != null && isNumeric(json.page_limit)) {
    query.setPagination(json.page_limit, json.page_offset);
  }

  json.sort_property &&
    query.setSorting(
      json.sort_property,
      Direction[(json.sort_direction as Direction) || "desc"],
    );

  json.time &&
    query.setTime(
      TimePrecision[json.time[0] as TimePrecision],
      isNumeric(json.time[1]) ? json.time[1] : TimeValue[json.time[1] as TimeValue],
    );

  json.options &&
    forEach(json.options, (value, key) => {
      value != null && query.setOption(key, value);
    });

  return query;
}

/**
 * Extracts the parameter information from a query into a plain object.
 * The returned object can be serialized into JSON, and rehydrated into a query
 * with the `Query#fromJSON` method.
 *
 * @param query The target query object
 */
export function extractQueryToJSON(query: Query): QueryDescriptor {
  const {cube} = query;
  const pagination = query.getParam("pagination");
  const sorting = query.getParam("sorting");
  const timeframe = query.getParam("time");

  return {
    server: cube.server,
    cube: cube.name,
    format: query.getParam("format"),
    locale: query.getParam("locale"),
    calculations: query.getParam("calculations").map(describeCalculation),
    captions: query.getParam("captions").map((item) => skimDescriptor(item.descriptor)),
    cuts: filterMap<QueryCut, CutDescriptor>(query.getParam("cuts"), (item) =>
      Level.isLevel(item.drillable)
        ? {
            ...skimDescriptor(item.drillable.descriptor),
            members: item.members,
            exclusive: item.isExclusive,
            for_match: item.isForMatch,
          }
        : null,
    ),
    drilldowns: filterMap<Drillable, LevelDescriptor>(
      query.getParam("drilldowns"),
      (item) => (Level.isLevel(item) ? skimDescriptor(item.descriptor) : null),
    ),
    filters: query.getParam("filters").map((item) => ({
      measure: Measure.isMeasure(item.measure) ? item.measure.name : item.measure,
      constraint: item.const1,
      joint: item.joint,
      constraint2: item.const2,
    })),
    page_limit: pagination.limit,
    page_offset: pagination.offset,
    measures: query.getParam("measures").map((item) => item.name),
    properties: query
      .getParam("properties")
      .map((item) => skimDescriptor(item.descriptor)),
    sort_property: Property.isProperty(sorting.property)
      ? skimDescriptor(sorting.property.descriptor)
      : Measure.isMeasure(sorting.property)
        ? sorting.property.name
        : sorting.property,
    sort_direction: sorting.direction,
    time:
      timeframe.precision != null && timeframe.value != null
        ? [timeframe.precision, timeframe.value]
        : undefined,
    options: query.getParam("options"),
  };
}

/**
 * This function outputs a simplified identification for the query components.
 * It's not intended to be reversible, only to be deterministic, and its primary
 * use case is to allow comparison and change control.
 *
 * @param query The target query object
 */
export function extractQueryToSearchParams(query: Query): any {
  const {cube} = query;
  const pagination = query.getParam("pagination");
  const sorting = query.getParam("sorting");
  const time = query.getParam("time");

  return {
    server: cube.server,
    cube: cube.name,
    format: query.getParam("format") || undefined,
    locale: query.getParam("locale") || undefined,
    calculations: query
      .getParam("calculations")
      .map(
        (item) =>
          `${item.kind}:${filterMap(Object.keys(item).sort(), (token) =>
            token === "kind" ? null : plainRef(item[token as keyof QueryCalc]),
          )}`,
      ),
    captions: query.getParam("captions").map((item) => item.fullName),
    cuts: query
      .getParam("cuts")
      .map(
        (item) =>
          `${item.isExclusive ? "~" : ""}${item.isForMatch ? "*" : ""}${
            item.drillable.fullName
          }.${item.members.join(",")}`,
      ),
    drilldowns: query.getParam("drilldowns").map((item) => item.fullName),
    filters: query
      .getParam("filters")
      .map((item) =>
        [
          Measure.isMeasure(item.measure) ? item.measure.name : item.measure,
          item.const1,
          item.joint && item.const2 ? item.joint : "",
          item.joint && item.const2 ? item.const2 : "",
        ]
          .filter(Boolean)
          .join(" "),
      ),
    page_limit: pagination.limit || undefined,
    page_offset: pagination.offset || undefined,
    measures: query.getParam("measures").map((item) => item.name),
    properties: query.getParam("properties").map((item) => item.fullName),
    sort_property: Property.isProperty(sorting.property)
      ? sorting.property.fullName
      : Measure.isMeasure(sorting.property)
        ? sorting.property.name
        : sorting.property,
    sort_direction: sorting.direction,
    time_precision: time.precision,
    time_value: time.value,
    options: query.getParam("options"),
  };
}

export function plainRef(item: string | Level | Measure | Property): string {
  if (Level.isLevel(item) || Property.isProperty(item)) return item.fullName;
  if (Measure.isMeasure(item)) return item.name;
  return item;
}

export function getSourceForQuery(query: Query): string {
  function expressionFor(token: any): string {
    if (token in Format) return `Format.${token}`;
    if (token in Comparison) return `Comparison.${token.toUpperCase()}`;
    if (token in Direction) return `Direction.${token.toUpperCase()}`;

    if (Array.isArray(token)) return `[${token.map(expressionFor).join(", ")}]`;

    return JSON.stringify(
      Level.isLevel(token.category) && Measure.isCalcOrMeasure(token.value)
        ? describeCalculation(token)
        : plainRef(token),
    );
  }

  function callSource(fnName: string, ...fnArgs: any[]): string {
    const argParams: string[] = [];
    let n = fnArgs.length;
    while (--n > 0) {
      const token = fnArgs[n];
      if (argParams.length === 0 && (token == null || token === "")) continue;
      argParams.push(expressionFor(token));
    }
    argParams.reverse();
    return argParams.length > 0 ? `.${fnName}(${argParams.join(", ")})` : "";
  }

  const options = query.getParam("options");
  const pagination = query.getParam("pagination");
  const sorting = query.getParam("sorting");
  const timeframe = query.getParam("time");

  return ["query"]
    .concat(
      callSource("setFormat", query.getParam("format")),
      callSource("setLocale", query.getParam("locale")),

      query.getParam("measures").map((item: Measure) => callSource("addMeasure", item)),

      query
        .getParam("drilldowns")
        .map((item: Drillable) => callSource("addDrilldown", item)),

      query.getParam("captions").map((item: Property) => callSource("addCaption", item)),

      query
        .getParam("properties")
        .map((item: Property) => callSource("addProperty", item)),

      query.getParam("cuts").map((item: QueryCut) =>
        callSource("addCut", item.drillable, item.members, {
          exclusive: item.isExclusive,
          forMatch: item.isForMatch,
        }),
      ),

      query
        .getParam("filters")
        .map((item: QueryFilter): string =>
          callSource(
            "addFilter",
            item.measure,
            item.const1,
            item.joint && item.const2 ? item.joint : "",
            item.joint && item.const2 ? item.const2 : "",
          ),
        ),

      query
        .getParam("calculations")
        .map(({kind, ...params}) => callSource("addCalculation", kind, params)),

      pagination.limit > 0
        ? callSource("setPagination", pagination.limit, pagination.offset)
        : "",

      sorting.property != null && sorting.direction != null
        ? callSource("setSorting", sorting.property, sorting.direction)
        : "",

      timeframe.precision != null && timeframe.value != null
        ? callSource("setTime", timeframe.precision, timeframe.value)
        : "",

      Object.keys(options).map((option) =>
        typeof options[option] === "boolean"
          ? callSource("setOption", option, options[option])
          : "",
      ),
    )
    .filter(Boolean)
    .join("\n  ");
}
