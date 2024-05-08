import type {Cube} from "./cube";
import type {PlainNamedSet} from "./interfaces/plain";
import type {Level} from "./level";
import {Annotated, FullNamed, Serializable, applyMixins} from "./toolbox/mixins";
import {hasProperty} from "./toolbox/validation";

export interface NamedSet extends Annotated, FullNamed, Serializable<PlainNamedSet> {}

export class NamedSet {
  private readonly _parent?: Cube;

  readonly _source: PlainNamedSet;
  readonly level?: Level;

  static isNamedset(obj: unknown): obj is NamedSet {
    return (
      obj != null &&
      hasProperty(obj, "_source") &&
      obj._source != null &&
      hasProperty(obj._source, "_type") &&
      obj._source._type === "namedset"
    );
  }

  constructor(source: PlainNamedSet, parent?: Cube) {
    this._parent = parent;
    this._source = source;

    const [dimension, hierarchy, level] = source.level;
    this.level = parent ? parent.getLevel({dimension, hierarchy, level}) : undefined;
  }

  get cube(): Cube {
    if (this._parent) {
      return this._parent;
    }
    throw new Error(`NamedSet ${this} doesn't have an associated parent cube.`);
  }
}

applyMixins(NamedSet, [Annotated, FullNamed, Serializable]);
