import {Comparison} from "../interfaces/enums";
import {Measure} from "../measure";
import type {QueryFilter} from "../query";

export function ifNotEmpty<T>(
  list: T[],
  stringifierFn: (item: T) => string = (item: T) => `${item}`,
  filterFn: (item: T) => boolean = Boolean,
): string[] | undefined {
  const result = list.filter(filterFn);
  return result.length > 0 ? result.map(stringifierFn) : undefined;
}

/**
 * Type guard to establish if an unknown key belongs in a certain object.
 */
export function isIn<T extends {}>(
  key: string | number | symbol,
  container: T,
): key is keyof T {
  return Object.prototype.hasOwnProperty.call(container, key);
}

/**
 * Type guard to establish if a certain key is present in an unknown object.
 */
export function hasProperty<T extends {}, U extends string | number | symbol>(
  obj: T,
  prop: U,
): obj is T & {[K in U]: unknown} {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

export function isNumeric(obj: string | number): obj is number {
  const value = typeof obj === "string" ? Number.parseFloat(obj) : obj;
  return !Number.isNaN(value) && Number.isFinite(value);
}

export function isQueryFilter(obj: unknown): obj is QueryFilter {
  return (
    obj != null &&
    hasProperty(obj, "measure") &&
    Measure.isCalcOrMeasure(obj.measure) &&
    hasProperty(obj, "const1") &&
    isQueryFilterConstraint(obj.const1) &&
    (hasProperty(obj, "joint") ? obj.joint === "and" || obj.joint === "or" : true) &&
    (hasProperty(obj, "const2") ? isQueryFilterConstraint(obj.const2) : true)
  );
}

export function isQueryFilterConstraint(obj: unknown): obj is [Comparison, number] {
  return Array.isArray(obj) && isIn(obj[0], Comparison) && isNumeric(obj[1]);
}
