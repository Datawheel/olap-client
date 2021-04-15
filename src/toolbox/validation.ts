import { Comparison } from "../interfaces/enums";
import { Measure } from "../measure";
import { QueryFilter } from "../query";

export function ifNotEmpty<T>(
  list: T[],
  stringifierFn: (item: T) => string = (item: T) => `${item}`,
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
    Measure.isCalcOrMeasure(obj.measure) &&
    isQueryFilterConstraint(obj.const1) &&
    (!obj.joint || ["and", "or"].includes(obj.joint)) &&
    (!obj.const2 || isQueryFilterConstraint(obj.const2))
  );
}

export function isQueryFilterConstraint(obj: any): obj is [Comparison, number] {
  return Array.isArray(obj) && Comparison.hasOwnProperty(obj[0]) && isNumeric(obj[1]);
}
