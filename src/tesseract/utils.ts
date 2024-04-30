import {Comparison} from "../interfaces/enums";
import {Measure} from "../measure";
import type {QueryFilter} from "../query";
import {isIn} from "../toolbox/validation";

export function normalizeFullName(fullname: string): string {
  return joinFullName(splitFullName(fullname));
}

export function joinFullName(nameParts: string[]): string {
  return nameParts.some((token: string) => token.includes("."))
    ? nameParts.map((token: string) => `[${token}]`).join(".")
    : nameParts.join(".");
}

export function splitFullName(fullName: string): string[] {
  const name = fullName.replace(/^\[|\]$/g, "");
  return name.indexOf("].[") > -1 ? name.split(/\]\.\[?/) : name.split(".");
}

export function parseCut(cut: string): {
  drillable: string;
  members: string[];
  exclusive: boolean;
  forMatch: boolean;
} {
  const exclusive = cut[0] === "~";
  cut = exclusive ? cut.slice(1) : cut;
  const forMatch = cut[0] === "*";
  cut = forMatch ? cut.slice(1) : cut;
  const nameParts = splitFullName(cut);
  const memberList = nameParts.pop() || "";
  const drillable = joinFullName(nameParts);
  const members = memberList.split(",");
  return {drillable, members, exclusive, forMatch};
}

export function parseFilterConstraints(token: string): {
  const1: [Comparison, number];
  const2?: [Comparison, number];
  joint?: "and" | "or";
} {
  const indexAnd = token.indexOf(".and.");
  if (indexAnd > -1) {
    const const1 = parseFilterCondition(token.slice(0, indexAnd));
    const const2 = parseFilterCondition(token.slice(indexAnd + 5));
    return {const1, const2, joint: "and"};
  }

  const indexOr = token.indexOf(".or.");
  if (indexOr > -1) {
    const const1 = parseFilterCondition(token.slice(0, indexOr));
    const const2 = parseFilterCondition(token.slice(indexOr + 4));
    return {const1, const2, joint: "or"};
  }

  return {const1: parseFilterCondition(token)};
}

export function parseFilterCondition(token: string): [Comparison, number] {
  const index = token.indexOf(".");
  const comparison = token.slice(0, index);
  if (!isIn(comparison, Comparison)) {
    throw new Error(`Invalid filter comparison token: ${comparison}`);
  }
  const scalar = token.slice(index + 1);
  const value = Number.parseFloat(scalar);
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    throw new Error(`Invalid filter scalar value: ${scalar}`);
  }
  return [Comparison[comparison], value];
}

export function stringifyFilter(item: QueryFilter): string {
  const tokens: (string | number | undefined)[] = [
    Measure.isMeasure(item.measure) ? item.measure.name : item.measure,
  ];
  return tokens.concat(item.const1, item.joint, item.const2).filter(Boolean).join(".");
}
