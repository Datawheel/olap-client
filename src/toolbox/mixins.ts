import { Annotations, IAnnotated, IFullNamed, INamed, ISerializable } from "../interfaces/plain";

export function applyMixins(derivedCtor: any, baseCtors: any[]) {
  baseCtors.forEach((baseCtor) => {
    Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
      if (name !== "constructor") {
        const propDescriptor = Object.getOwnPropertyDescriptor(baseCtor.prototype, name);
        if (propDescriptor) {
          Object.defineProperty(derivedCtor.prototype, name, propDescriptor);
        }
      }
    });
  });
}

export class Annotated {
  readonly _source: IAnnotated;

  get annotations(): Annotations {
    return this._source.annotations;
  }

  getAnnotation(key: string, defaultValue?: string): string {
    const value = this._source.annotations[key];
    if (value !== undefined) {
      return value;
    }
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Annotation ${key} does not exist in ${this.constructor.name} ${this}.`);
  }

  getLocaleAnnotation(key: string, locale: string, defaultValue?: string): string {
    const value = this._source.annotations[`${key}_${locale}`];
    return value !== undefined ? value : this.getAnnotation(key, defaultValue);
  }
}

export class FullNamed {
  readonly _source: IFullNamed;

  get caption(): string {
    return this._source.caption || this._source.name;
  }

  get fullName(): string {
    return this._source.fullName || this._source.name;
  }

  get name(): string {
    return this._source.name;
  }
}

export class Named {
  readonly _source: INamed;

  get name(): string {
    return this._source.name;
  }
}

export class Serializable<T extends ISerializable> {
  readonly _source: T;

  toJSON(): T {
    return this._source;
  }

  toString(): string {
    return this._source.uri;
  }
}
