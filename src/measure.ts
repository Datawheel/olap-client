import type {Cube} from "./cube";
import {type AggregatorType, Calculation} from "./interfaces/enums";
import type {PlainMeasure} from "./interfaces/plain";
import {Annotated, FullNamed, Serializable, applyMixins} from "./toolbox/mixins";
import {hasProperty} from "./toolbox/validation";

export type CalcOrMeasure = Calculation | Measure;

export interface Measure extends Annotated, FullNamed, Serializable<PlainMeasure> {}

export class Measure {
  private readonly _parent?: Cube;

  readonly _source: PlainMeasure;

  static isCalcOrMeasure(obj: unknown): obj is CalcOrMeasure {
    return (typeof obj === "string" && obj in Calculation) || Measure.isMeasure(obj);
  }

  static isMeasure(obj: unknown): obj is Measure {
    return (
      obj != null &&
      hasProperty(obj, "_source") &&
      obj._source != null &&
      hasProperty(obj._source, "_type") &&
      obj._source._type === "measure"
    );
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

  get displayName(): string {
    return this._source.name;
  }
}

applyMixins(Measure, [Annotated, FullNamed, Serializable]);
