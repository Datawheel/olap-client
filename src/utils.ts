import Cube from "./cube";
import {ClientError} from "./errors";
import {INamed, LevelDescriptor} from "./interfaces";
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

export function ensureArray(value: any): any[] {
  return value == null ? [] : [].concat(value);
}

export function levelFinderFactory(descriptor: LevelDescriptor): (cube: Cube) => Level {
  const {level: levelName, hierarchy, dimension, cube: cubeName} = descriptor;
  return (cube: Cube): Level => {
    if (!cubeName || cube.name === cubeName) {
      for (let level of cube.levelIterator) {
        if (level.name === levelName) {
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

export function pushUnique<T>(target: T[], item: T) {
  return target.indexOf(item) === -1 ? target.push(item) : target.length;
}

export function switchCase<T>(cases: any, key: string, defaultCase: T): T {
  return cases.hasOwnProperty(key) ? cases[key] : defaultCase;
}
