import { Cube } from "./cube";
import { AggregatorType, Calculation } from "./interfaces/enums";
import { PlainMeasure } from "./interfaces/plain";
import { Annotated, applyMixins, FullNamed, Serializable } from "./toolbox/mixins";

export type CalcOrMeasure = Calculation | Measure;

export interface Measure extends Annotated, FullNamed, Serializable<PlainMeasure> {}

export class Measure {
  private readonly _parent?: Cube;

  readonly _source: PlainMeasure;

  static isCalcOrMeasure(obj: any): obj is CalcOrMeasure {
    return Calculation.hasOwnProperty(obj) || Measure.isMeasure(obj);
  }

  static isMeasure(obj: any): obj is Measure {
    return Boolean(obj && obj._source && obj._source._type === "measure");
  }

  constructor(source: PlainMeasure, parent?: Cube) {
    this._parent = parent;
    this._source = source;
  }

  get aggregatorType(): AggregatorType {
    return this._source.aggregatorType;
  }

  get cube(): Cube {
    if (this._parent) {
      return this._parent;
    }
    throw new Error(`Measure ${this} doesn't have an associated parent cube.`);
  }
}

applyMixins(Measure, [Annotated, FullNamed, Serializable]);
