import { Comparison } from "../interfaces/enums";
import { Measure } from "../measure";
import { QueryFilter } from "../query";
import { isNumeric } from "../toolbox/validation";

export function normalizeFullName(fullname: string): string {
  return joinFullName(splitFullName(fullname));
}

export function joinFullName(nameParts: string[]): string {
  return nameParts.some((token: string) => token.includes("."))
    ? nameParts.map((token: string) => `[${token}]`).join(".")
    : nameParts.join(".");
}

export function splitFullName(fullname: string): string[] {
  fullname = fullname.replace(/^\[|\]$/g, "");
  return fullname.indexOf("].[") > -1
    ? fullname.split(/\]\.\[?/)
    : fullname.split(".");
}

export function parseCut(
  cut: string
): {
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
  return { drillable, members, exclusive, forMatch };
}

export function parseFilterConstraints(
  item: string
): { constraints: [Comparison, number][]; joint?: "and" | "or" } {
  const constraints = item
    .substr(item.indexOf(".") + 1)
    .split(/\.or\.|\.and\./)
    .map(item => {
      const index = item.indexOf(".");
      const comparison = Comparison[item.substr(0, index)];
      const value = Number.parseFloat(item.substr(index + 1));
      return comparison && isNumeric(value) ? [comparison, value] : undefined;
    })
    .filter(Boolean) as [Comparison, number][];
  const joint =
    constraints.length > 1
      ? item.indexOf(".and.") > -1
        ? "and"
        : "or"
      : undefined;
  return { constraints, joint };
}

export function stringifyFilter(item: QueryFilter): string {
  return ([
    Measure.isMeasure(item.measure) ? item.measure.name : item.measure,
  ] as any[])
    .concat(item.const1, item.joint, item.const2)
    .filter(Boolean)
    .join(".");
}
