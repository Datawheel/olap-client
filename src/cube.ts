import {Dimension} from "./dimension";
import type {IDataSource} from "./interfaces/contracts";
import {DimensionType} from "./interfaces/enums";
import type {PlainCube} from "./interfaces/plain";
import {Level, type LevelReference} from "./level";
import {Measure} from "./measure";
import {NamedSet} from "./namedset";
import type {Property, PropertyReference} from "./property";
import {type Drillable, type DrillableReference, Query} from "./query";
import {childClassMapper, iteratorMatch} from "./toolbox/collection";
import {Annotated, FullNamed, Serializable, applyMixins} from "./toolbox/mixins";
import {hasProperty} from "./toolbox/validation";

export interface Cube extends Annotated, FullNamed, Serializable<PlainCube> {}

export class Cube {
  private readonly _parent?: IDataSource;

  readonly _source: PlainCube;
  readonly dimensions: Dimension[] = [];
  readonly dimensionsByName: Readonly<Record<string, Dimension>> = {};
  readonly measures: Measure[] = [];
  readonly measuresByName: Readonly<Record<string, Measure>> = {};
  readonly namedsets: NamedSet[] = [];
  readonly namedsetsByName: Readonly<Record<string, NamedSet>> = {};

  static isCube(obj: unknown): obj is Cube {
    return (
      obj != null &&
      hasProperty(obj, "_source") &&
      obj._source != null &&
      hasProperty(obj._source, "_type") &&
      obj._source._type === "cube"
    );
  }

  constructor(source: PlainCube, parent?: IDataSource) {
    this._parent = parent;
    this._source = source;

    const dimensions = childClassMapper(Dimension, source.dimensions, this);
    this.dimensions = dimensions[0];
    this.dimensionsByName = dimensions[1];

    const measures = childClassMapper(Measure, source.measures, this);
    this.measures = measures[0];
    this.measuresByName = measures[1];

    const namedsets = childClassMapper(NamedSet, source.namedsets, this);
    this.namedsets = namedsets[0];
    this.namedsetsByName = namedsets[1];
  }

  get caption(): string {
    return this._source.annotations.caption || this._source.name;
  }

  get datasource(): IDataSource {
    if (this._parent) {
      return this._parent;
    }
    throw new Error(`Cube ${this} doesn't have an associated server url.`);
  }

  get defaultMeasure(): Measure {
    const measureName = this._source.annotations.default || "undefined";
    return this.measuresByName[measureName] || this.measures[0];
  }

  get geoDimension(): Dimension | undefined {
    return this.dimensions.find((d) => d.dimensionType === DimensionType.Geographic);
  }

  get query(): Query {
    return new Query(this);
  }

  get server(): string {
    return this.datasource.serverUrl;
  }

  get serverSoftware(): string {
    return this.datasource.serverSoftware;
  }

  get standardDimensions(): Dimension[] {
    return this.findDimensionsByType(DimensionType.Standard);
  }

  get timeDimension(): Dimension | undefined {
    return this.dimensions.find((d) => d.dimensionType === DimensionType.Time);
  }

  get levelIterator(): IterableIterator<Level> {
    return this.levelIteratorFactory();
  }

  get propertyIterator(): IterableIterator<Property> {
    return this.propertyIteratorFactory();
  }

  findDimensionsByType(type: DimensionType): Dimension[] {
    return this.dimensions.filter((d) => d.dimensionType === type);
  }

  getDimension(ref: string | Dimension): Dimension {
    const dimensionName = typeof ref === "string" ? ref : ref.name;
    const dimension = this.dimensionsByName[dimensionName];
    if (dimension) {
      return dimension;
    }
    throw new Error(`Object ${ref} is not a valid dimension identifier`);
  }

  getDrillable(ref: DrillableReference): Drillable {
    if (NamedSet.isNamedset(ref)) return this.getNamedSet(ref);
    if (Level.isLevel(ref)) return this.getLevel(ref);
    return this.namedsetsByName[`${ref}`] || this.getLevel(ref);
  }

  getLevel(ref: LevelReference): Level {
    const iterator = this.levelIteratorFactory();
    const match = iteratorMatch<Level, LevelReference>(iterator, ref);
    if (match != null) {
      return match;
    }
    throw new Error(`Object ${ref} didn't match any level in cube ${this.name}`);
  }

  getMeasure(ref: string | Measure): Measure {
    const measureName = typeof ref === "string" ? ref : ref.name;
    const measure = this.measuresByName[measureName];
    if (measure) {
      return measure;
    }
    throw new Error(`Object ${ref} is not a valid measure identifier`);
  }

  getNamedSet(ref: string | NamedSet): NamedSet {
    const namedsetName = typeof ref === "string" ? ref : ref.name;
    const namedset = this.namedsetsByName[namedsetName];
    if (namedset) {
      return namedset;
    }
    throw new Error(`Object ${ref} is not a valid namedset identifier`);
  }

  getProperty(ref: PropertyReference): Property {
    const iterator = this.propertyIteratorFactory();
    const match = iteratorMatch<Property, PropertyReference>(iterator, ref);
    if (match != null) {
      return match;
    }
    throw new Error(`Object ${ref} didn't match any level in cube ${this.name}`);
  }

  private levelIteratorFactory(): IterableIterator<Level> {
    const {dimensions} = this;
    let levelIterator = dimensions[0].levelIterator;
    let d = 0;

    function next(): IteratorResult<Level, undefined> {
      if (d === dimensions.length) {
        return {value: undefined, done: true};
      }
      const nextIteration = levelIterator.next();
      if (nextIteration.done) {
        levelIterator = dimensions[++d]?.levelIterator;
        return next();
      }
      return nextIteration;
    }

    const iterator = {next, [Symbol.iterator]: () => iterator};
    return iterator;
  }

  private propertyIteratorFactory(): IterableIterator<Property> {
    const {dimensions} = this;
    let d = 0;
    let propertyIterator = dimensions[d].propertyIterator;

    function next(): IteratorResult<Property, undefined> {
      if (d === dimensions.length) {
        return {value: undefined, done: true};
      }
      const nextProperty = propertyIterator.next();
      if (nextProperty.done) {
        propertyIterator = dimensions[++d]?.propertyIterator;
        return next();
      }
      return nextProperty;
    }

    const iterator = {next, [Symbol.iterator]: () => iterator};
    return iterator;
  }
}

applyMixins(Cube, [Annotated, FullNamed, Serializable]);
