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

function undefinedHelpers() {
  const undefinedIfEmpty = <T, U>(
    array: T[],
    mapFn: (a: T, b: number, c: T[]) => U
  ): U[] | undefined => (array.length ? array.map(mapFn) : undefined);

  const undefinedIfIncomplete = <T extends any, U>(
    value: T,
    transformFn: (a: Required<T>) => U
  ): U | undefined => {
    try {
      return transformFn(value as Required<T>);
    } catch (e) {
      return undefined;
    }
  };

  const undefinedIfZero = (value: number): number | undefined =>
    value !== 0 ? value : undefined;

  return {undefinedIfEmpty, undefinedIfIncomplete, undefinedIfZero};
}

export function joinFullName(nameParts: string[]): string {
  return nameParts.some((token: string) => token.indexOf(".") > -1)
    ? nameParts.map((token: string) => `[${token}]`).join(".")
    : nameParts.join(".");
}

export function aggregateQueryBuilder(
  query: Query
): {[key: string]: string[] | string | number | boolean | undefined} {
  const {undefinedIfEmpty, undefinedIfIncomplete, undefinedIfZero} = undefinedHelpers();

  const options = query.getParam("options");
  const tesseractQuery = {
    captions: query.getParam("captions"),
    cut: [] as string[],
    debug: options.debug ? true : undefined,
    drilldowns: undefinedIfEmpty(
      query.getParam("drilldowns"),
      (d: Drillable) => d.fullName
    ),
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
    measures: undefinedIfEmpty(query.getParam("measures"), (m: Measure) => m.name),
    parents: Boolean(options.parents),
    properties: undefinedIfEmpty(query.getParam("properties"), (p: QueryProperty) =>
      joinFullName(p.level.fullNameSplit.concat(p.name))
    ),
    rate: undefined,
    rca: undefinedIfIncomplete(
      query.getParam("rca"),
      (r: Required<QueryRCA>) =>
        `${r.level1.fullName},${r.level2.fullName},${r.measure.name}`
    ),
    sort: undefined,
    sparse: Boolean(options.sparse),
    top_where: undefined,
    top: undefinedIfIncomplete(
      query.getParam("topk"),
      (t: Required<QueryTopk>) =>
        `${t.amount},${t.level.fullName},${t.measure.name},${t.order}`
    )
  };

  const cuts = query.getParam("cuts");
  Object.keys(cuts).forEach(drillableFullname => {
    const fullnameSplit = splitFullName(drillableFullname);
    if (fullnameSplit) {
      const cut = stringifyCut(fullnameSplit, cuts[drillableFullname]);
      cut && tesseractQuery.cut.push(cut);
    }
  });

  return tesseractQuery;
}

export function logicLayerQueryBuilder(
  query: Query
): {[key: string]: string[] | string | number | boolean | undefined} {
  const {undefinedIfEmpty, undefinedIfIncomplete} = undefinedHelpers();

  const cube = query.cube;
  const options = query.getParam("options");
  const drilldowns = undefinedIfEmpty(
    query.getParam("drilldowns"),
    (d: Drillable) => (Level.isLevel(d) ? d.uniqueName : d.name)
  );
  const measures = undefinedIfEmpty(query.getParam("measures"), (m: Measure) => m.name);

  const tesseractQuery = {
    cube: cube.name,
    debug: options.debug ? true : undefined,
    drilldowns: drilldowns ? drilldowns.join(",") : undefined,
    locale: query.getParam("locale"),
    measures: measures ? measures.join(",") : undefined,
    parents: Boolean(options.parents),
    sparse: Boolean(options.sparse),
    growth: undefinedIfIncomplete(query.getParam("growth"), (g: Required<QueryGrowth>) =>
      [g.level.fullName, g.measure.name].join(",")
    ),
    rca: undefinedIfIncomplete(query.getParam("rca"), (r: Required<QueryRCA>) =>
      [r.level1.fullName, r.level2.fullName, r.measure.name].join(",")
    ),
    top: undefinedIfIncomplete(query.getParam("topk"), (t: Required<QueryTopk>) =>
      [t.amount, t.level.fullName, t.measure.name, t.order].join(",")
    )
  };

  const cuts = query.getParam("cuts");
  for (let level of cube.levelIterator) {
    if (cuts.hasOwnProperty(level.fullName)) {
      tesseractQuery[level.uniqueName] = cuts[level.fullName].join(",");
    }
  }

  return tesseractQuery;
}

export function splitFullName(fullname: string): string[] | undefined {
  if (!fullname) return undefined;
  fullname = `${fullname}`.replace(/^\[|\]$/g, "");
  return fullname.indexOf("].[") > -1 ? fullname.split(/\]\.\[?/) : fullname.split(".");
}

export function stringifyCut(
  drillable: string[],
  members: string[] = []
): string | undefined {
  return members.length > 0
    ? joinFullName(drillable.concat(members.join(",")))
    : undefined;
}
