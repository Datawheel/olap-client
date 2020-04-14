import Cube from "./cube";
import { Comparison, Direction } from "./enums";
import { ClientError } from "./errors";
import {
  INamed,
  LevelDescriptor,
  ParseURLOptions,
  QueryCut,
  QueryFilter,
  QueryGrowth,
  QueryPagination,
  QueryProperty,
  QueryRCA,
  QuerySorting,
  QueryTimeframe,
  QueryTopk
} from "./interfaces";
import Level from "./level";
import Measure from "./measure";
import { Query } from "./query";

const hasOwnProperty = Object.prototype.hasOwnProperty;

export function applyMixins(derivedCtor: any, baseCtors: any[]) {
  baseCtors.forEach(baseCtor => {
    Object.getOwnPropertyNames(baseCtor.prototype).forEach(name => {
      if (name !== "constructor") {
        const propDescriptor = Object.getOwnPropertyDescriptor(baseCtor.prototype, name);
        if (propDescriptor) {
          Object.defineProperty(derivedCtor.prototype, name, propDescriptor);
        }
      }
    });
  });
}

export function applyParseUrlRules<T>(
  qp: T,
  options: Partial<ParseURLOptions> = {}
): Partial<T> {
  const { exclude, include, filter } = options;

  const always = () => true;
  let tester = typeof filter === "function" ? filter : always;

  if (exclude || include) {
    const included = Array.isArray(include)
      ? (key: string) =>
          include.reduce((result, pattern) => result && key === pattern, true)
      : always;
    const notExcluded = Array.isArray(exclude)
      ? (key: string) =>
          exclude.reduce((result, pattern) => result && key !== pattern, true)
      : always;

    tester = key => included(key) && notExcluded(key);
  }

  const qpFinal: Partial<T> = {};
  Object.keys(qp).forEach(key => {
    const value = qp[key];
    tester(key, value) &&
      Object.defineProperty(qpFinal, key, { enumerable: true, value });
  });

  return qpFinal;
}

export function ensureArray<T>(value: T[] | T | undefined | null): T[] {
  return value == null ? [] : ([] as T[]).concat(value);
}

export function groupBy<T>(
  list: T[],
  property: keyof T,
  targetMap: Record<string, T[]> = {}
) {
  for (let item of list) {
    const key = `${item[property]}`;
    if (hasOwnProperty.call(targetMap, key)) {
      targetMap[key].push(item);
    } else {
      targetMap[key] = [item];
    }
  }
  return targetMap;
}

export function ifValid<T, U>(
  item: any,
  validatorFn: (item: any) => item is T,
  callbackFn: (item: T) => U
): U | undefined {
  return validatorFn(item) ? callbackFn(item) : undefined;
}

export function ifNotEmpty<T>(
  list: T[],
  stringifierFn: (item: T) => string = item => `${item}`,
  filterFn: (item: T) => boolean = Boolean
): string[] | undefined {
  const result = list.filter(filterFn);
  return result.length > 0 ? result.map(stringifierFn) : undefined;
}

export function isNumeric(obj: any): obj is number {
  return !isNaN(Number.parseFloat(obj)) && isFinite(obj);
}

export function isQueryFilter(obj: any): obj is QueryFilter {
  return (
    obj &&
    Measure.isCalculation(obj.measure) &&
    Comparison[obj.comparison] &&
    isNumeric(obj.value)
  );
}

export function isQueryGrowth(obj: any): obj is QueryGrowth {
  return obj && Level.isLevel(obj.level) && Measure.isMeasure(obj.measure);
}

export function isQueryPagination(obj: any): obj is QueryPagination {
  return obj && obj.amount > 0;
}

export function isQueryRCA(obj: any): obj is QueryRCA {
  return (
    obj &&
    Level.isLevel(obj.level1) &&
    Level.isLevel(obj.level2) &&
    Measure.isMeasure(obj.measure)
  );
}

export function isQuerySorting(obj: any): obj is QuerySorting {
  return obj && obj.property;
}

export function isQueryTimeframe(item: any): item is QueryTimeframe {
  return item && "latest|oldest".indexOf(item.value) > -1;
}

export function isQueryTopk(obj: any): obj is QueryTopk {
  return (
    obj &&
    obj.amount > 0 &&
    Measure.isCalculation(obj.measure) &&
    Level.isLevel(obj.level) &&
    Direction[obj.order]
  );
}

export function levelFinderFactory(descriptor: LevelDescriptor): (cube: Cube) => Level {
  const { level: levelName, hierarchy, dimension, cube: cubeName } = descriptor;
  return (cube: Cube): Level => {
    if (!cubeName || cube.name === cubeName) {
      for (let level of cube.levelIterator) {
        if (level.uniqueName === levelName) {
          const sameHie = hierarchy ? hierarchy === level.hierarchy.name : true;
          const sameDim = dimension ? dimension === level.dimension.name : true;
          if (sameDim && sameHie) {
            return level;
          }
        }
      }
      for (let level of cube.levelIterator) {
        if (level.name === levelName) {
          const sameHie = hierarchy ? hierarchy === level.hierarchy.name : true;
          const sameDim = dimension ? dimension === level.dimension.name : true;
          if (sameDim && sameHie) {
            return level;
          }
        }
      }
      for (let level of cube.levelIterator) {
        if (level.fullName === levelName) {
          const sameHie = hierarchy ? hierarchy === level.hierarchy.name : true;
          const sameDim = dimension ? dimension === level.dimension.name : true;
          if (sameDim && sameHie) {
            return level;
          }
        }
      }
    }
    throw new ClientError(
      `No level matched the descriptor ${JSON.stringify(descriptor)}`
    );
  };
}

export function nameMapperFactory<P>(context: P) {
  return <T extends INamed, C>(
    list: T[],
    ctor: new (...args: any[]) => C
  ): [C[], { [name: string]: C }] => {
    const targetList = [];
    const targetMap = {};
    for (let obj of list) {
      const key = obj.name;
      const value = new ctor(obj, context);
      targetList.push(value);
      targetMap[key] = value;
    }
    return [targetList, targetMap];
  };
}

export function pushUnique<T>(target: T[], item: T) {
  return target.indexOf(item) === -1 ? target.push(item) : target.length;
}

export function queryToSource(query: Query) {
  const captionToSource = (item: QueryProperty): string =>
    `.addCaption("${item.level.fullName}", "${item.name}")`;
  const cutToSource = (item: QueryCut): string =>
    `.addCut("${item.drillable.fullName}", [${item.members.join(", ")}])`;
  const filterToSource = (item: QueryFilter): string => {
    const calc = Measure.isMeasure(item.measure) ? item.measure.name : item.measure;
    const constr = (constr: [Comparison, number]): string =>
      `[Comparison.${constr[0].toUpperCase()}, ${constr[1]}]`;
    const secondConstr =
      item.joint && item.const2 ? `, "${item.joint}", ${constr(item.const2)}` : "";
    return `.addFilter("${calc}", ${constr(item.const1)}${secondConstr})`;
  };
  const propertyToSource = (item: QueryProperty): string =>
    `.addProperty("${item.level.fullName}", "${item.name}")`;
  const formatToSource = (item: string): string => (item ? `.setFormat("${item}")` : "");
  const growthToSource = (item: QueryGrowth): string =>
    `.setGrowth("${item.level.fullName}", "${item.measure.name}")`;
  const localeToSource = (item: string): string => `.setLocale(${item})`;
  const optionToSource = (option: string): string =>
    booleans[option] != null ? `.setOption("${option}", ${booleans[option]})` : "";
  const paginationToSource = (item: QueryPagination): string =>
    `.setPagination(${item.amount}${item.offset > 0 ? `, ${item.offset}` : ""})`;
  const rcaToSource = (item: QueryRCA): string =>
    `.setRCA("${item.level1.fullName}", "${item.level2.fullName}", "${item.measure.name}")`;
  const sortingToSource = (item: QuerySorting): string =>
    typeof item.property === "string"
      ? `.setSorting("${item.property}", "${item.direction}")`
      : Measure.isMeasure(item.property)
      ? `.setSorting("${item.property.name}", "${item.direction}")`
      : `.setSorting("${item.property.level.fullName}", "${item.property.name}", "${item.direction}")`;
  const timeToSource = (item: QueryTimeframe): string =>
    item.value != null
      ? `.setTime("${item.value}"${item.precision != null ? `, ${item.precision}` : ""})`
      : "";
  const topkToSource = (item: QueryTopk): string =>
    `.setTop(${item.amount}, "${item.level.fullName}", "${
      typeof item.measure === "string" ? item.measure : item.measure.name
    }", "${item.order}")`;

  const booleans = query.getParam("options");

  return ["query"]
    .concat(
      query.getParam("captions").map(captionToSource),
      query.getParam("cuts").map(cutToSource),
      query.getParam("drilldowns").map(item => `.addDrilldown("${item.fullName}")`),
      query.getParam("filters").map(filterToSource),
      formatToSource(query.getParam("format")),
      ifValid<QueryGrowth, string>(
        query.getParam("growth"),
        isQueryGrowth,
        growthToSource
      ) || "",
      localeToSource(query.getParam("locale")),
      query.getParam("measures").map(item => `.addMeasure("${item.name}")`),
      ["debug", "distinct", "nonempty", "parents", "sparse"].map(optionToSource),
      query.getParam("properties").map(propertyToSource),
      ifValid<QueryRCA, string>(query.getParam("rca"), isQueryRCA, rcaToSource) || "",
      ifValid<QuerySorting, string>(
        query.getParam("sorting"),
        isQuerySorting,
        sortingToSource
      ) || "",
      ifValid<QueryPagination, string>(
        query.getParam("pagination"),
        isQueryPagination,
        paginationToSource
      ) || "",
      ifValid<QueryTimeframe, string>(
        query.getParam("time"),
        isQueryTimeframe,
        timeToSource
      ) || "",
      ifValid<QueryTopk, string>(query.getParam("topk"), isQueryTopk, topkToSource) || ""
    )
    .filter(Boolean)
    .join("\n  ");
}

export function switchCase<T>(cases: any, key: string, defaultCase: T): T {
  return hasOwnProperty.call(cases, key) ? cases[key] : defaultCase;
}
