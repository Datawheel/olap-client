import { QueryCut, QueryFilter } from "../query";
import { MondrianFilterOperator } from "./interfaces";

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

export function rangeify(list: number[]) {
  const groups: { [diff: string]: number[] } = {};
  list.sort().forEach((item: number, i: number) => {
    const diff = item - i;
    groups[diff] = groups[diff] || [];
    groups[diff].push(item);
  });
  return Object.values(groups).map((group) =>
    group.length > 1 ? [group[0], group[group.length - 1]] : group[0]
  );
}

export function splitFullName(fullName: string): string[] {
  return `${fullName}`.replace(/^\[|\]$/g, "").split(/\]\.\[?/);
}

export function splitPropertyName(fullName: string): [string, string] {
  const propIndex = fullName.lastIndexOf(".");
  return [fullName.slice(0, propIndex), fullName.slice(propIndex + 1)]
}

export function stringifyCut(item: QueryCut): string {
  const { drillable, members } = item;
  const cut = members.map((member: string) => `${drillable}.&[${member}]`).join(",");
  return members.length > 1 ? `{${cut}}` : cut;
}

export function stringifyFilter(item: QueryFilter): string {
  const operator = MondrianFilterOperator[item.const1[0]];
  return typeof item.measure !== "string" && operator
    ? `${item.measure.name} ${operator} ${item.const1[1]}`
    : "";
}
