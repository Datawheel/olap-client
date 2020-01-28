import Cube from "./cube";
import {ClientError} from "./errors";
import {INamed, LevelDescriptor, ParseURLOptions} from "./interfaces";
import Level from "./level";

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
  const {exclude, include, filter} = options;

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
    tester(key, value) && Object.defineProperty(qpFinal, key, {enumerable: true, value});
  });

  return qpFinal;
}

export function ensureArray<T>(value: T[] | T | undefined | null): T[] {
  return value == null ? [] : ([] as T[]).concat(value);
}

export function levelFinderFactory(descriptor: LevelDescriptor): (cube: Cube) => Level {
  const {level: levelName, hierarchy, dimension, cube: cubeName} = descriptor;
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
  ): [C[], {[name: string]: C}] => {
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

export function groupBy<T>(
  list: T[],
  property: keyof T,
  targetMap: {[key: string]: T[]} = {}
) {
  for (let item of list) {
    const key = `${item[property]}`;
    const target = targetMap[key] || [];
    target.push(item);
    targetMap[key] = target;
  }
  return targetMap;
}

export function pushUnique<T>(target: T[], item: T) {
  return target.indexOf(item) === -1 ? target.push(item) : target.length;
}

export function switchCase<T>(cases: any, key: string, defaultCase: T): T {
  return cases.hasOwnProperty(key) ? cases[key] : defaultCase;
}

export function undefinedHelpers() {
  function undefinedIfEmpty<T>(array: T[]): T[] | undefined;
  function undefinedIfEmpty<T, U>(
    array: T[],
    mapFn: (a: T, b: number, c: T[]) => U
  ): U[] | undefined;
  function undefinedIfEmpty(array: any[], mapFn?: (...args: any[]) => any): any {
    return array.length ? (mapFn ? array.map(mapFn) : array) : undefined;
  }

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

  const undefinedIfKeyless = <T, U>(
    obj: T,
    mapFn: (key: keyof T, value: T[keyof T]) => U | undefined
  ): U[] | undefined => {
    const list = Object.keys(obj)
      .map(key => mapFn(key as keyof T, obj[key]))
      .filter(item => item != null) as U[];
    return list.length ? list : undefined;
  };

  const undefinedIfZero = (value: number): number | undefined =>
    value !== 0 ? value : undefined;

  return {undefinedIfEmpty, undefinedIfIncomplete, undefinedIfKeyless, undefinedIfZero};
}
