import Cube from "./cube";
import {AggregatorType} from "./enums";
import {ClientError} from "./errors";
import {AdaptedMeasure} from "./interfaces";
import {Annotated, FullNamed, Serializable} from "./mixins";
import {applyMixins} from "./utils";

interface Measure extends Annotated, FullNamed, Serializable<AdaptedMeasure> {}

class Measure {
  private readonly _parent?: Cube;

  readonly _source: AdaptedMeasure;

  static isMeasure(obj: any): obj is Measure {
    return Boolean(obj && obj._source && obj._source._type === "measure");
  }

  constructor(source: AdaptedMeasure, parent?: Cube) {
    this._parent = parent;
    this._source = source;
  }

  get aggregatorType(): AggregatorType {
    return this._source.aggregatorType;
  }

  get cube(): Cube {
    if (!this._parent) {
      throw new ClientError(`Measure ${this} doesn't have an associated parent cube.`);
    }
    return this._parent;
  }
}

applyMixins(Measure, [Annotated, FullNamed, Serializable]);

export default Measure;
