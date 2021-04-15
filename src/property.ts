import { Cube } from "./cube";
import { PropertyDescriptor } from "./interfaces/descriptors";
import { PlainProperty } from "./interfaces/plain";
import { Level } from "./level";
import { Annotated, applyMixins, Named, Serializable } from "./toolbox/mixins";

export type PropertyReference = string | PropertyDescriptor | Property;

export interface Property extends Annotated, Named, Serializable<PlainProperty> {}

export class Property {
  readonly _source: PlainProperty;
  private readonly _parent?: Level;

  static isProperty(obj: any): obj is Property {
    return Boolean(obj && obj._source && obj._source._type === "property");
  }

  static isPropertyDescriptor(obj: any): obj is PropertyDescriptor {
    return Boolean(
      obj &&
      obj.property &&
      typeof obj.property === "string" &&
      (!obj.level || typeof obj.level === "string")
    );
  }

  constructor(source: PlainProperty, parent?: Level) {
    this._parent = parent;
    this._source = source;
  }

  get captionSet(): string {
    return this._source.captionSet || "";
  }

  get cube(): Cube {
    return this.level.cube;
  }

  get descriptor(): PropertyDescriptor {
    return {
      ...this.level.descriptor,
      property: this.name,
    };
  }

  get fullName(): string {
    return this.level.fullName + "." + this.name;
  }

  get level(): Level {
    if (!this._parent) {
      throw new Error(`Property ${this} doesn't have an associated parent hierarchy.`);
    }
    return this._parent;
  }

  get uniqueName(): string {
    return this._source.uniqueName || this._source.name;
  }

  matches(ref: PropertyReference): boolean {
    if (typeof ref === "string") {
      return this._source.uniqueName === ref ||
        this.fullName === ref ||
        this._source.name === ref;
    }
    else if (Property.isPropertyDescriptor(ref)) {
      const level = this._parent ? this.level : undefined;
      return this.matches(ref.property) && (!level || (
          (!ref.level || level.matches(ref.level)) &&
          (!ref.hierarchy || ref.hierarchy === level.hierarchy.name) &&
          (!ref.dimension || ref.dimension === level.dimension.name) &&
          (!ref.cube || ref.cube === level.cube.name) &&
          (!ref.server || ref.server === level.cube.server)
        )
      );
    }
    else if (Property.isProperty(ref)) {
      return this === ref || this.matches(ref.descriptor);
    }
    return false;
  }
}

applyMixins(Property, [Annotated, Named, Serializable]);
