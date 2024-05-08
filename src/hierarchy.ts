import type {Cube} from "./cube";
import type {Dimension} from "./dimension";
import type {PlainHierarchy} from "./interfaces/plain";
import {Level, type LevelReference} from "./level";
import {childClassMapper} from "./toolbox/collection";
import {Annotated, FullNamed, Serializable, applyMixins} from "./toolbox/mixins";
import {abbreviateFullName} from "./toolbox/strings";
import {hasProperty} from "./toolbox/validation";

export interface Hierarchy extends Annotated, FullNamed, Serializable<PlainHierarchy> {}

export class Hierarchy {
  private readonly _parent?: Dimension;

  readonly _source: PlainHierarchy;
  readonly levels: Level[] = [];
  readonly levelsByName: Readonly<Record<string, Level>> = {};

  static isHierarchy(obj: unknown): obj is Hierarchy {
    return (
      obj != null &&
      hasProperty(obj, "_source") &&
      obj._source != null &&
      hasProperty(obj._source, "_type") &&
      obj._source._type === "hierarchy"
    );
  }

  constructor(source: PlainHierarchy, parent?: Dimension) {
    this._parent = parent;
    this._source = source;

    const levels = childClassMapper(Level, source.levels, this);
    this.levels = levels[0];
    this.levelsByName = levels[1];
  }

  get cube(): Cube {
    return this.dimension.cube;
  }

  get dimension(): Dimension {
    if (this._parent) {
      return this._parent;
    }
    throw new Error(`Hierarchy ${this} doesn't have an associated parent dimension.`);
  }

  get displayName(): string {
    return abbreviateFullName([this._source.dimension, this._source.name]);
  }

  getLevel(ref: LevelReference): Level {
    const levelName = Level.isLevel(ref)
      ? ref.name
      : Level.isLevelDescriptor(ref)
        ? ref.level
        : ref;
    const level = this.levelsByName[levelName];
    if (level) {
      return level;
    }
    throw new Error(`Object ${ref} is not a valid level identifier`);
  }
}

applyMixins(Hierarchy, [Annotated, FullNamed, Serializable]);
