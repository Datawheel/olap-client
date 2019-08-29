import Measure from "../measure";
import {Drillable, Query, QueryFilter, QueryProperty} from "../query";

export function joinFullName(nameParts: string[]): string {
  return nameParts.map((token: string) => `[${token}]`).join(".");
}

export function parseCut(cut: string): [string, string[]] {
  if (cut.indexOf("].&[") === -1) {
    throw TypeError(`Couldn't parse cut: ${cut}`);
  }
  cut = `${cut}`.replace(/^\{|\}$/g, "");
  const [drillable] = cut.split(".&", 1);
  const members = cut
    .split(",")
    .map((member: string) => {
      const [, key] = member.split("].&[");
      return key ? key.replace("]", "") : undefined;
    })
    .filter(Boolean) as string[];
  return [drillable, members];
}

export function queryBuilder(
  query: Query
): {[key: string]: string[] | string | number | boolean | undefined} {
  const undefinedIfEmpty = <T, U>(
    array: T[],
    mapFn: (a: T, b: number, c: T[]) => U
  ): U[] | undefined => (array.length ? array.map(mapFn) : undefined);
  const undefinedIfZero = (value: number): number | undefined =>
    value > 0 ? value : undefined;

  const options = query.getParam("options");
  const mondrianQuery = {
    caption: query.getParam("captions"),
    cut: [] as string[],
    debug: options.debug,
    distinct: options.distinct,
    drilldown: undefinedIfEmpty(
      query.getParam("drilldowns"),
      (d: Drillable) => d.fullName
    ),
    filter: undefinedIfEmpty(
      query.getParam("filters"),
      (f: QueryFilter) => `${f.measure.name} ${f.comparison} ${f.value}`
    ),
    limit: undefinedIfZero(query.getParam("limit")),
    measures: undefinedIfEmpty(query.getParam("measures"), (m: Measure) => m.name),
    nonempty: options.nonempty,
    offset: undefinedIfZero(query.getParam("offset")),
    order_desc: query.getParam("orderDescendent") ? true : undefined,
    order: query.getParam("orderProperty"),
    parents: options.parents,
    properties: undefinedIfEmpty(
      query.getParam("properties"),
      (p: QueryProperty) => `${p.level.fullName}.${p.name}`
    ),
    sparse: options.sparse
  };

  const cuts = query.getParam("cuts");
  Object.keys(cuts).forEach(fullname => {
    const cut = stringifyCut(fullname, cuts[fullname]);
    cut && mondrianQuery.cut.push(cut);
  });

  return mondrianQuery;
}

export function rangeify(list: number[]) {
  const groups: {
    [diff: string]: number[];
  } = list.sort().reduce((groups: any[], item: number, i: number) => {
    const diff = item - i;
    groups[diff] = groups[diff] || [];
    groups[diff].push(item);
    return groups;
  }, {});
  return Object.keys(groups).map(diff => {
    const group = groups[diff];
    return group.length > 1 ? [group[0], group[group.length - 1]] : group[0];
  });
}

export function splitFullName(fullname: string): string[] | undefined {
  return fullname ? `${fullname}`.replace(/^\[|\]$/g, "").split(/\]\.\[?/) : undefined;
}

export function stringifyCut(drillable: string, members: string[] = []) {
  const cut = members.map((member: string) => `${drillable}.&[${member}]`).join(",");
  return members.length === 0 ? undefined : members.length > 1 ? `{${cut}}` : cut;
}
