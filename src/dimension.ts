import type {Cube} from "./cube";
import {Hierarchy} from "./hierarchy";
import type {DimensionType} from "./interfaces/enums";
import type {PlainDimension} from "./interfaces/plain";
import type {Level, LevelReference} from "./level";
import type {Property, PropertyReference} from "./property";
import {childClassMapper, iteratorMatch} from "./toolbox/collection";
import {Annotated, FullNamed, Serializable, applyMixins} from "./toolbox/mixins";
import {hasProperty} from "./toolbox/validation";

export interface Dimension extends Annotated, FullNamed, Serializable<PlainDimension> {}

export class Dimension {
  private readonly _parent?: Cube;

  readonly _source: PlainDimension;
  readonly hierarchies: Hierarchy[] = [];
  readonly hierarchiesByName: Readonly<Record<string, Hierarchy>> = {};

  static isDimension(obj: unknown): obj is Dimension {
    return (
      obj != null &&
      hasProperty(obj, "_source") &&
      obj._source != null &&
      hasProperty(obj._source, "_type") &&
      obj._source._type === "dimension"
    );
  }

  constructor(source: PlainDimension, parent?: Cube) {
    this._parent = parent;
    this._source = source;

    const hierarchies = childClassMapper(Hierarchy, source.hierarchies, this);
    this.hierarchies = hierarchies[0];
    this.hierarchiesByName = hierarchies[1];
  }

  get caption(): string {
    return this._source.annotations.caption || this._source.name;
  }

  get cube(): Cube {
    if (this._parent) {
      return this._parent;
    }
    throw new Error(`Dimension ${this} doesn't have an associated parent cube.`);
  }

  get defaultHierarchy(): Hierarchy | undefined {
    return this.hierarchiesByName[this._source.defaultHierarchy] || this.hierarchies[0];
  }

  get dimensionType(): DimensionType {
    return this._source.dimensionType;
  }

  get displayName(): string {
    return this._source.name;
  }

  get levelIterator(): IterableIterator<Level> {
    return this.levelIteratorFactory();
  }

  get propertyIterator(): IterableIterator<Property> {
    return this.propertyIteratorFactory();
  }

  getHierarchy(ref: string | Hierarchy): Hierarchy {
    const hierarchyName = typeof ref === "string" ? ref : ref.name;
    const hierarchy = this.hierarchiesByName[hierarchyName];
    if (hierarchy) {
      return hierarchy;
    }
    throw new Error(`Object ${ref} didn't match any hierarchy in dimension ${this.name}`);
  }

  getLevel(ref: LevelReference): Level {
    const iterator = this.levelIteratorFactory();
    const match = iteratorMatch<Level, LevelReference>(iterator, ref);
    if (match != null) {
      return match;
    }
    throw new Error(`Object ${ref} didn't match any level in dimension ${this.name}`);
  }

  getProperty(ref: PropertyReference): Property {
    const iterator = this.propertyIteratorFactory();
    const match = iteratorMatch<Property, PropertyReference>(iterator, ref);
    if (match != null) {
      return match;
    }
    throw new Error(`Object ${ref} didn't match any property in dimension ${this.name}`);
  }

  private levelIteratorFactory(): IterableIterator<Level> {
    const {hierarchies} = this;
    let h = 0;
    let l = 0;

    function next(): IteratorResult<Level, undefined> {
      if (h === hierarchies.length) {
        return {value: undefined, done: true};
      }
      const {levels} = hierarchies[h];
      if (l === levels.length) {
        h++;
        l = 0;
        return next();
      }
      return {value: levels[l++], done: false};
    }

    const iterator = {next, [Symbol.iterator]: () => iterator};
    return iterator;
  }

  private propertyIteratorFactory(): IterableIterator<Property> {
    const levelIterator = this.levelIteratorFactory();
    let currentLevel = levelIterator.next();
    let p = 0;

    function next(): IteratorResult<Property, undefined> {
      if (currentLevel.done) {
        return {value: undefined, done: true};
      }
      const {properties} = currentLevel.value;
      if (p === properties.length) {
        currentLevel = levelIterator.next();
        p = 0;
        return next();
      }
      return {value: properties[p++], done: false};
    }

    const iterator = {next, [Symbol.iterator]: () => iterator};
    return iterator;
  }
}

applyMixins(Dimension, [Annotated, FullNamed, Serializable]);
