import Cube from "./cube";
import { DimensionType } from "./enums";
import { ClientError } from "./errors";
import Hierarchy from "./hierarchy";
import { AdaptedDimension } from "./interfaces";
import Level from "./level";
import { Annotated, FullNamed, Serializable } from "./mixins";
import { applyMixins, nameMapperFactory } from "./utils";

interface Dimension
  extends Annotated,
    FullNamed,
    Serializable<AdaptedDimension> {}

class Dimension {
  private readonly _parent?: Cube;

  readonly _source: AdaptedDimension;
  readonly hierarchies: Hierarchy[] = [];
  readonly hierarchiesByName: { readonly [name: string]: Hierarchy } = {};

  static isDimension(obj: any): obj is Dimension {
    return Boolean(obj && obj._source && obj._source._type === "dimension");
  }

  constructor(source: AdaptedDimension, parent?: Cube) {
    this._parent = parent;
    this._source = source;

    const nameMapper = nameMapperFactory(this);

    const [hierarchies, hierarchiesByName] = nameMapper(
      source.hierarchies,
      Hierarchy
    );
    this.hierarchies = hierarchies;
    this.hierarchiesByName = hierarchiesByName;
  }

  get caption(): string {
    return this._source.annotations["caption"] || this._source.name;
  }

  get cube(): Cube {
    if (!this._parent) {
      throw new ClientError(
        `Dimension ${this} doesn't have an associated parent cube.`
      );
    }
    return this._parent;
  }

  get defaultHierarchy(): Hierarchy | undefined {
    return (
      this.hierarchiesByName[this._source.defaultHierarchy] ||
      this.hierarchies[0]
    );
  }

  get dimensionType(): DimensionType {
    return this._source.dimensionType;
  }

  getHierarchy(identifier: string | Hierarchy): Hierarchy {
    const hierarchyName =
      typeof identifier === "string" ? identifier : identifier.name;
    const hierarchy = this.hierarchiesByName[hierarchyName];
    if (!hierarchy) {
      throw new ClientError(
        `Object ${identifier} is not a valid hierarchy identifier`
      );
    }
    return hierarchy;
  }

  get levelIterator(): IterableIterator<Level> {
    return this.levelIteratorFactory();
  }

  private levelIteratorFactory(): IterableIterator<Level> {
    const { hierarchies } = this;
    let h = 0;
    let l = 0;

    function next(): IteratorResult<Level> {
      if (h === hierarchies.length) {
        return { value: undefined, done: true };
      }
      const hierarchy = hierarchies[h];
      if (l === hierarchy.levels.length) {
        h++;
        l = 0;
        return next();
      }
      return { value: hierarchy.levels[l++], done: false };
    }

    const iterator = { next, [Symbol.iterator]: () => iterator };
    return iterator;
  }
}

applyMixins(Dimension, [Annotated, FullNamed, Serializable]);

export default Dimension;
