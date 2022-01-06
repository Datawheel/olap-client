import { Cube } from "./cube";
import { Dimension } from "./dimension";
import { Hierarchy } from "./hierarchy";
import { LevelDescriptor } from "./interfaces/descriptors";
import { PlainLevel, PlainProperty } from "./interfaces/plain";
import { Property } from "./property";
import { childClassMapper } from "./toolbox/collection";
import { Annotated, applyMixins, FullNamed, Serializable } from "./toolbox/mixins";
import { abbreviateFullName } from "./toolbox/strings";

export type LevelReference = string | LevelDescriptor | Level;

export interface Level extends Annotated, FullNamed, Serializable<PlainLevel> {}

export class Level {
  private readonly _parent?: Hierarchy;

  readonly _source: PlainLevel;
  readonly properties: Property[] = [];
  readonly propertiesByName: Readonly<Record<string, Property>> = {};

  static isLevel(obj: any): obj is Level {
    return Boolean(obj && obj._source && obj._source._type === "level");
  }

  static isLevelDescriptor(obj: any): obj is LevelDescriptor {
    return Boolean(obj && obj.level && typeof obj.level === "string");
  }

  constructor(source: PlainLevel, parent?: Hierarchy) {
    this._parent = parent;
    this._source = source;

    const properties = childClassMapper(Property, source.properties, this);
    this.properties = properties[0];
    this.propertiesByName = properties[1];
  }

  get cube(): Cube {
    return this.dimension.cube;
  }

  get depth(): number {
    return this._source.depth;
  }

  get descriptor(): LevelDescriptor {
    const descriptor: LevelDescriptor = {
      cube: this._source.cube,
      dimension: this._source.dimension,
      hierarchy: this._source.hierarchy,
      level: this._source.name,
    };
    try {
      descriptor.server = this.cube.server;
    }
    catch (e) {}
    return descriptor;
  }

  get dimension(): Dimension {
    return this.hierarchy.dimension;
  }

  get hierarchy(): Hierarchy {
    if (!this._parent) {
      throw new Error(`Level ${this} doesn't have an associated parent hierarchy.`);
    }
    return this._parent;
  }

  get displayName(): string {
    return abbreviateFullName([
      this._source.dimension,
      this._source.hierarchy,
      this._source.name,
    ]);
  }

  get uniqueName(): string {
    return this._source.uniqueName || this._source.name;
  }

  hasProperty(propertyName: string): boolean {
    const INTRINSIC_PROPERTIES = ["Caption", "Key", "Name", "UniqueName"];
    return (
      INTRINSIC_PROPERTIES.indexOf(propertyName) > -1 ||
      this._source.properties.some((prop: PlainProperty) => prop.name === propertyName)
    );
  }

  matches(ref: LevelReference): boolean {
    if (typeof ref === "string") {
      return this._source.uniqueName === ref ||
        this._source.fullName === ref ||
        this._source.name === ref;
    }
    else if (Level.isLevelDescriptor(ref)) {
      return this.matches(ref.level) &&
        (!ref.hierarchy || ref.hierarchy === this._source.hierarchy) &&
        (!ref.dimension || ref.dimension === this._source.dimension) &&
        (!ref.cube || ref.cube === this._source.cube) &&
        (!ref.server || ref.server === this.cube.server);
    }
    else if (Level.isLevel(ref)) {
      return this === ref || this.matches(ref.descriptor);
    }
    return false;
  }
}

applyMixins(Level, [Annotated, FullNamed, Serializable]);
