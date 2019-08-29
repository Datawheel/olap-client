import {ClientError} from "./errors";
import {Annotations, IAnnotated, IFullNamed, ISerializable} from "./interfaces";

export class Annotated {
  readonly _source: IAnnotated;

  get annotations(): Annotations {
    return this._source.annotations;
  }

  getAnnotation(key: string, defaultValue?: string): string {
    const value = this._source.annotations[key];
    if (value === undefined) {
      if (defaultValue === undefined) {
        throw new ClientError(
          `Annotation ${key} does not exist in ${this.constructor.name} ${this}.`
        );
      }
      return defaultValue;
    }
    return value;
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

  get fullNameSplit(): string[] {
    return this._source.splitFullName || [this._source.name];
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
