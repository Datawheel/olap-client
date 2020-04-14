import Cube from "./cube";
import { ClientError } from "./errors";
import { AdaptedNamedSet } from "./interfaces";
import Level from "./level";
import { Annotated, FullNamed, Serializable } from "./mixins";
import { applyMixins } from "./utils";

interface NamedSet extends Annotated, FullNamed, Serializable<AdaptedNamedSet> {}

class NamedSet {
  private readonly _parent?: Cube;

  readonly _source: AdaptedNamedSet;
  readonly level?: Level;

  static isNamedset(obj: any): obj is NamedSet {
    return Boolean(obj && obj._source && obj._source._type === "namedset");
  }

  constructor(source: AdaptedNamedSet, parent?: Cube) {
    this._parent = parent;
    this._source = source;

    const [dimension, hierarchy, level] = source.level;
    this.level = parent ? parent.getLevel({ dimension, hierarchy, level }) : undefined;
  }

  get cube(): Cube {
    if (!this._parent) {
      throw new ClientError(`NamedSet ${this} doesn't have an associated parent cube.`);
    }
    return this._parent;
  }
}

applyMixins(NamedSet, [Annotated, FullNamed, Serializable]);

export default NamedSet;
