import type {INamed} from "../interfaces/plain";
import {isIn} from "./validation";

export function asArray<T>(value: T[] | T | undefined | null): T[] {
  return value == null ? [] : ([] as T[]).concat(value);
}

export function splitTokens(
  value: undefined | null | string | string[],
  partition = ",",
): string[] {
  if (value == null) return [];
  return (Array.isArray(value) ? value.join(partition) : value).split(partition);
}

export function filterMap<T, U>(
  list: T[],
  predicate: (item: T, index: number, collection: T[]) => U | null,
): U[] {
  let index = -1;
  const length = list.length;
  const mappedList: U[] = [];

  while (++index < length) {
    const newValue = predicate(list[index], index, list);
    newValue !== null && mappedList.push(newValue);
  }

  return mappedList;
}

export function forEach<T extends unknown[] | Record<string, unknown>>(
  collection: T,
  predicate: (item: T[keyof T], index: keyof T, collection: T) => any,
): void {
  const iterable = Object(collection) as T;
  const keys = Object.keys(collection) as (keyof T)[];
  let index = -1;
  let length = keys.length;

  while (length--) {
    const key = keys[++index];
    if (predicate(iterable[key], key, iterable) === false) {
      break;
    }
  }
}

export function groupBy<T>(list: Iterable<T>, property: keyof T) {
  const acc = new Aggregator((): T[] => []);
  for (const item of list) {
    acc.get(`${item[property]}`).push(item);
  }
  return acc.aggregation;
}

class Aggregator<T> {
  _accumulator: Record<string, T[]>;
  _factory: () => T[];

  constructor(factory: () => T[]) {
    this._factory = factory;
    this._accumulator = {};
  }

  get aggregation() {
    return {...this._accumulator};
  }

  get(key: string): T[] {
    if (!isIn(key, this._accumulator)) {
      this._accumulator[key] = this._factory();
    }
    return this._accumulator[key];
  }
}

export function pushUnique<T>(target: T[], item: T) {
  return target.indexOf(item) === -1 ? target.push(item) : target.length;
}

/**
 * @param iterator An iterator that produces elements with a `#matches()` method
 * @param ref The reference object to match against
 * @returns The matching object from the iterator results, or undefined is there's no match
 */
export function iteratorMatch<T extends {matches: (ref: U) => boolean}, U>(
  iterator: IterableIterator<T>,
  ref: U,
) {
  while (true) {
    const iteration = iterator.next();
    if (iteration.done) break;

    const item: T = iteration.value;
    if (item.matches(ref)) {
      return item;
    }
  }
  return undefined;
}

export function childClassMapper<C, T extends INamed, P>(
  ctor: new (...args: any[]) => C,
  list: T[],
  parent: P,
): [C[], Record<string, C>] {
  const targetList: C[] = [];
  const targetMap: Record<string, C> = {};

  for (let i = 0; i < list.length; i++) {
    const obj = list[i];
    const key = obj.name;
    const value = new ctor(obj, parent);
    targetList.push(value);
    targetMap[key] = value;
  }
  return [targetList, targetMap];
}
