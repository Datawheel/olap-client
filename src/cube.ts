import Dimension from "./dimension";
import { DimensionType } from "./enums";
import { ClientError } from "./errors";
import { AdaptedCube, IDataSource, LevelDescriptor, LevelReference } from "./interfaces";
import Level from "./level";
import Measure from "./measure";
import { Annotated, FullNamed, Serializable } from "./mixins";
import NamedSet from "./namedset";
import { Query } from "./query";
import { applyMixins, levelFinderFactory, nameMapperFactory } from "./utils";

interface Cube extends Annotated, FullNamed, Serializable<AdaptedCube> {}

class Cube {
  private readonly _parent?: IDataSource;

  readonly _source: AdaptedCube;
  readonly dimensions: Dimension[] = [];
  readonly dimensionsByName: Readonly<Record<string, Dimension>> = {};
  readonly measures: Measure[] = [];
  readonly measuresByName: Readonly<Record<string, Measure>> = {};
  readonly namedsets: NamedSet[] = [];
  readonly namedsetsByName: Readonly<Record<string, NamedSet>> = {};

  static isCube(obj: any): obj is Cube {
    return Boolean(obj && obj._source && obj._source._type === "cube");
  }

  constructor(source: AdaptedCube, parent?: IDataSource) {
    this._parent = parent;
    this._source = source;

    const nameMapper = nameMapperFactory(this);

    const dimensionMap = nameMapper(source.dimensions, Dimension);
    this.dimensions = dimensionMap[0];
    this.dimensionsByName = dimensionMap[1];

    const measureMap = nameMapper(source.measures, Measure);
    this.measures = measureMap[0];
    this.measuresByName = measureMap[1];

    const namedsetMap = nameMapper(source.namedsets, NamedSet);
    this.namedsets = namedsetMap[0];
    this.namedsetsByName = namedsetMap[1];
  }

  get caption(): string {
    return this._source.annotations["caption"] || this._source.name;
  }

  get datasource(): IDataSource {
    if (!this._parent) {
      throw new ClientError(`Cube ${this} doesn't have an associated server url.`);
    }
    return this._parent;
  }

  get defaultMeasure(): Measure {
    const measureName = this._source.annotations["default"] || "undefined";
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

  findDimensionsByType(type: DimensionType): Dimension[] {
    return this.dimensions.filter((d) => d.dimensionType === type);
  }

  getDimension(identifier: string | Dimension): Dimension {
    const dimensionName = typeof identifier === "string" ? identifier : identifier.name;
    const dimension = this.dimensionsByName[dimensionName];
    if (!dimension) {
      const reason = `Object ${identifier} is not a valid dimension identifier`;
      throw new ClientError(reason);
    }
    return dimension;
  }

  getLevel(identifier: LevelReference): Level {
    const descriptor =
      typeof identifier === "string"
        ? ({ level: identifier } as LevelDescriptor)
        : Level.isLevel(identifier)
        ? identifier.descriptor
        : identifier;
    return levelFinderFactory(descriptor)(this);
  }

  getMeasure(identifier: string | Measure): Measure {
    const measureName = typeof identifier === "string" ? identifier : identifier.name;
    const measure = this.measuresByName[measureName];
    if (!measure) {
      throw new ClientError(`Object ${identifier} is not a valid measure identifier`);
    }
    return measure;
  }

  getNamedSet(identifier: string | NamedSet): NamedSet {
    const namedsetName = typeof identifier === "string" ? identifier : identifier.name;
    const namedset = this.namedsetsByName[namedsetName];
    if (!namedset) {
      throw new ClientError(`Object ${identifier} is not a valid namedset identifier`);
    }
    return namedset;
  }

  get levelIterator(): IterableIterator<Level> {
    return this.levelIteratorFactory();
  }

  private levelIteratorFactory(): IterableIterator<Level> {
    const { dimensions } = this;
    let levelIterator = dimensions[0].levelIterator;
    let d = 0;

    function next(): IteratorResult<Level> {
      if (d === dimensions.length) {
        return { value: undefined, done: true };
      }
      const nextIteration = levelIterator.next();
      if (nextIteration.done) {
        levelIterator = dimensions[++d]?.levelIterator;
        return next();
      }
      return nextIteration;
    }

    const iterator = { next, [Symbol.iterator]: () => iterator };
    return iterator;
  }
}

applyMixins(Cube, [Annotated, FullNamed, Serializable]);

export default Cube;
