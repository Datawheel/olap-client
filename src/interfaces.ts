import Cube from "./cube";
import {AggregatorType, Comparison, DimensionType, Order} from "./enums";
import Level from "./level";
import Measure from "./measure";
import Member from "./member";
import {Query} from "./query";
import {AxiosRequestConfig} from "axios";

export interface AdaptedCube extends IAnnotated, IFullNamed, ISerializable {
  readonly _type: "cube";
  readonly dimensions: AdaptedDimension[];
  readonly measures: AdaptedMeasure[];
  readonly namedsets: AdaptedNamedSet[];
}

export interface AdaptedDimension
  extends IAnnotated,
    IFullNamed,
    ISerializable {
  readonly _type: "dimension";
  readonly cube: string;
  readonly defaultHierarchy: string;
  readonly dimensionType: DimensionType;
  readonly hierarchies: AdaptedHierarchy[];
}

export interface AdaptedHierarchy
  extends IAnnotated,
    IFullNamed,
    ISerializable {
  readonly _type: "hierarchy";
  readonly cube: string;
  readonly dimension: string;
  readonly levels: AdaptedLevel[];
}

export interface AdaptedLevel extends IAnnotated, IFullNamed, ISerializable {
  readonly _type: "level";
  readonly caption: string;
  readonly cube: string;
  readonly depth: number;
  readonly dimension: string;
  readonly hierarchy: string;
  readonly properties: AdaptedProperty[];
  readonly uniqueName?: string;
}

export interface AdaptedMeasure extends IAnnotated, IFullNamed, ISerializable {
  readonly _type: "measure";
  readonly aggregatorType: AggregatorType;
  readonly cube: string;
}

export interface AdaptedMember extends IFullNamed, ISerializable {
  readonly _type: "member";
  readonly ancestors: AdaptedMember[];
  readonly children: AdaptedMember[];
  readonly depth?: number;
  readonly key: string | number;
  readonly level: string;
  readonly numChildren?: number;
  readonly parentName?: string;
}

export interface AdaptedNamedSet extends IAnnotated, INamed, ISerializable {
  readonly _type: "namedset";
  readonly cube: string;
  readonly dimension: string;
  readonly hierarchy: string;
  readonly level: string;
}

export interface AdaptedProperty extends INamed {
  readonly _type: "property";
  readonly annotations: Annotations;
  readonly cube: string;
  readonly dimension: string;
  readonly hierarchy: string;
  readonly level: string;
}

export interface Aggregation<T = any> {
  data: T;
  headers: Record<string, string>;
  query: Query;
  status?: number;
  url?: string;
}

export interface Annotations {
  [key: string]: string | undefined;
}

export interface IAnnotated {
  readonly annotations: Annotations;
}

export interface IClient {
  execQuery(query: Query, endpoint?: string): Promise<Aggregation>;
  getCube(
    cubeName: string,
    selectorFn?: (cubes: Cube[]) => Cube
  ): Promise<Cube>;
  getCubes(): Promise<Cube[]>;
  getMember(
    parent: Level | LevelDescriptor,
    key: string | number,
    options?: any
  ): Promise<Member>;
  getMembers(parent: Level | LevelDescriptor, options?: any): Promise<Member[]>;
  parseQueryURL(url: string, options: Partial<ParseURLOptions>): Promise<Query>;
  setRequestConfig(config: AxiosRequestConfig): void;
}

export interface IDataSource {
  checkStatus(): Promise<ServerStatus>;
  execQuery(query: Query, endpoint?: string): Promise<Aggregation>;
  fetchCube(cubeName: string): Promise<AdaptedCube>;
  fetchCubes(): Promise<AdaptedCube[]>;
  fetchMember(
    parent: Level,
    key: string | number,
    options?: any
  ): Promise<AdaptedMember>;
  fetchMembers(parent: Level, options?: any): Promise<AdaptedMember[]>;
  parseQueryURL(
    query: Query,
    url: string,
    options: Partial<ParseURLOptions>
  ): Query;
  serverOnline: boolean;
  serverSoftware: string;
  serverUrl: string;
  serverVersion: string;
  setRequestConfig(config: AxiosRequestConfig): void;
  stringifyQueryURL(query: Query, kind: string): string;
}

export interface IFullNamed extends INamed {
  readonly caption?: string;
  readonly fullName?: string;
}

export interface INamed {
  readonly name: string;
}

export interface ISerializable {
  readonly uri: string;
}

export interface LevelDescriptor {
  server?: string;
  cube?: string;
  dimension?: string;
  hierarchy?: string;
  level: string;
}

export interface ServerStatus {
  software: string;
  online: boolean;
  url: string;
  version: string;
}

export interface ParseURLOptions {
  exclude: string[];
  include: string[];
  filter: (key: string, value: string | boolean | string[]) => boolean;
}

export interface QueryFilter {
  measure: Measure;
  comparison: Comparison;
  value: number;
}

export interface QueryGrowth {
  level?: Level;
  measure?: Measure;
}

export interface QueryOptions {
  debug?: boolean;
  distinct?: boolean;
  nonempty?: boolean;
  parents?: boolean;
  sparse?: boolean;
}

export interface QueryProperty {
  level: Level;
  name: string;
}

export interface QueryRCA {
  level1?: Level;
  level2?: Level;
  measure?: Measure;
}

export interface QueryTopk {
  amount?: number;
  level?: Level;
  measure?: Measure;
  order?: Order;
}
