import { Comparison, Direction } from "../enums";
import {
  QueryCut,
  QueryFilter,
  QueryPagination,
  QueryProperty,
  QuerySorting
} from "../interfaces";
import Level from "../level";
import Measure from "../measure";
import { isNumeric } from "../utils";

export function joinFullName(nameParts: string[]): string {
  return nameParts.some((token: string) => token.indexOf(".") > -1)
    ? nameParts.map((token: string) => `[${token}]`).join(".")
    : nameParts.join(".");
}

export function splitFullName(fullname: string): string[] {
  fullname = `${fullname}`.replace(/^\[|\]$/g, "");
  return fullname.indexOf("].[") > -1 ? fullname.split(/\]\.\[?/) : fullname.split(".");
}

export function parseCut(cut: string): [string, string[]] {
  const nameParts = splitFullName(cut);
  const memberList = nameParts.pop() || "";
  const drillable = joinFullName(nameParts);
  const members = memberList.split(",");
  return [drillable, members];
}

export function parseFilterConstraints(
  item: string
): { constraints: [Comparison, number][]; joint?: "and" | "or" } {
  const constraints = item
    .substr(item.indexOf(".") + 1)
    .split(/\.or\.|\.and\./)
    .map((item) => {
      const index = item.indexOf(".");
      const comparison = Comparison[item.substr(0, index)];
      const value = Number.parseFloat(item.substr(index + 1));
      return comparison && isNumeric(value) ? [comparison, value] : undefined;
    })
    .filter(Boolean) as [Comparison, number][];
  const joint =
    constraints.length > 1 ? (item.indexOf(".and.") > -1 ? "and" : "or") : undefined;
  return { constraints, joint };
}

export function stringifyCut(item: QueryCut): string {
  const { drillable } = item;
  const name = Level.isLevel(drillable)
    ? [drillable.dimension.name, drillable.hierarchy.name, drillable.name]
    : splitFullName(drillable.fullName);
  return joinFullName(name.concat(item.members.join(",")));
}

export function stringifyFilter(item: QueryFilter): string {
  return ([Measure.isMeasure(item.measure) ? item.measure.name : item.measure] as any[])
    .concat(item.const1, item.joint, item.const2)
    .filter(Boolean)
    .join(".");
}

export function stringifyPagination(item: QueryPagination): string {
  return item.offset > 0 ? `${item.offset},${item.amount}` : `${item.amount}`;
}

export function stringifyProperty(item: QueryProperty): string {
  return joinFullName([
    item.level.dimension.name,
    item.level.hierarchy.name,
    item.level.name,
    item.name
  ]);
}

/**
 * Converts a sorting descriptor object to its URL string equivalent
 * Tesseract only accepts measures, "rca", and "growth" as sorting properties.
 * @param item The sorting descriptor object
 */
export function stringifySorting(item: QuerySorting): string {
  const property =
    typeof item.property === "string" ? item.property :
    Measure.isMeasure(item.property)  ? item.property.name :
    /* else */                          stringifyProperty(item.property);
  return `${property}.${Direction[item.direction] || "desc"}`;
}
