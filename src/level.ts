import Cube from "./cube";
import Dimension from "./dimension";
import {ClientError} from "./errors";
import Hierarchy from "./hierarchy";
import {AdaptedLevel, AdaptedProperty, LevelDescriptor} from "./interfaces";
import {Annotated, FullNamed, Serializable} from "./mixins";
import {applyMixins} from "./utils";

interface Level extends Annotated, FullNamed, Serializable<AdaptedLevel> {}

class Level {
  readonly _source: AdaptedLevel;
  private readonly _parent?: Hierarchy;

  static isLevel(obj: any): obj is Level {
    return Boolean(obj && obj._source && obj._source._type === "level");
  }

  static isLevelDescriptor(obj: any): obj is LevelDescriptor {
    return Boolean(obj && obj.level && typeof obj.level === "string");
  }

  constructor(source: AdaptedLevel, parent?: Hierarchy) {
    this._parent = parent;
    this._source = source;
  }

  get cube(): Cube {
    return this.dimension.cube;
  }

  get depth(): number {
    return this._source.depth;
  }

  get descriptor(): LevelDescriptor {
    const descriptor: LevelDescriptor = {level: this.name};
    try {
      const {hierarchy} = this;
      descriptor.hierarchy = hierarchy.name;
      const {dimension} = hierarchy;
      descriptor.dimension = dimension.name;
      const {cube} = dimension;
      descriptor.cube = cube.name;
      descriptor.server = cube.server;
    } catch (e) {}
    return descriptor;
  }

  get dimension(): Dimension {
    return this.hierarchy.dimension;
  }

  get hierarchy(): Hierarchy {
    if (!this._parent) {
      throw new ClientError(`Level ${this} doesn't have an associated parent hierarchy.`);
    }
    return this._parent;
  }

  get properties(): AdaptedProperty[] {
    return this._source.properties;
  }

  get uniqueName(): string {
    return this._source.uniqueName || this._source.name;
  }

  hasProperty(propertyName: string): boolean {
    const INTRINSIC_PROPERTIES = ["Caption", "Key", "Name", "UniqueName"];
    return (
      INTRINSIC_PROPERTIES.indexOf(propertyName) > -1 ||
      this._source.properties.some(prop => prop.name === propertyName)
    );
  }
}

applyMixins(Level, [FullNamed, Serializable]);

export default Level;
