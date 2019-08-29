import Cube from "./cube";
import {AggregatorType, DimensionType} from "./enums";
import Level from "./level";
import Member from "./member";
import {Query} from "./query";

export interface AdaptedCube extends IAnnotated, IFullNamed, ISerializable {
  readonly _type: "cube";
  readonly dimensions: AdaptedDimension[];
  readonly measures: AdaptedMeasure[];
  readonly namedsets: AdaptedNamedSet[];
}

export interface AdaptedDimension extends IAnnotated, IFullNamed, ISerializable {
  readonly _type: "dimension";
  readonly defaultHierarchy: string;
  readonly dimensionType: DimensionType;
  readonly hierarchies: AdaptedHierarchy[];
}

export interface AdaptedHierarchy extends IAnnotated, IFullNamed, ISerializable {
  readonly _type: "hierarchy";
  readonly allMemberName?: string;
  readonly levels: AdaptedLevel[];
}

export interface AdaptedLevel extends IAnnotated, IFullNamed, ISerializable {
  readonly _type: "level";
  readonly caption: string;
  readonly depth: number;
  readonly properties: AdaptedProperty[];
  readonly uniqueName?: string;
}

export interface AdaptedMeasure extends IAnnotated, IFullNamed, ISerializable {
  readonly _type: "measure";
  readonly aggregatorType: AggregatorType;
}

export interface AdaptedMember extends IFullNamed, ISerializable {
  readonly _type: "member";
  readonly allMember?: boolean;
  readonly ancestors?: AdaptedMember[];
  readonly children?: AdaptedMember[];
  readonly depth?: number;
  readonly drillable?: boolean;
  readonly key: string | number;
  readonly numChildren?: number;
  readonly parentName?: string;
}

export interface AdaptedNamedSet extends IAnnotated, INamed, ISerializable {
  readonly _type: "namedset";
  readonly level: [string, string, string];
}

export interface AdaptedProperty {
  readonly annotations: Annotations;
  readonly name: string;
}

export interface Aggregation<T = any> {
  data: T;
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
  getCube(cubeName: string, selectorFn?: (cubes: Cube[]) => Cube): Promise<Cube>;
  getCubes(): Promise<Cube[]>;
  getMember(
    parent: Level | LevelDescriptor,
    key: string | number,
    options?: any
  ): Promise<Member>;
  getMembers(parent: Level | LevelDescriptor, options?: any): Promise<Member[]>;
}

export interface IDataSource {
  checkStatus(): Promise<ServerStatus>;
  execQuery(query: Query, endpoint?: string): Promise<Aggregation>;
  fetchCube(cubeName: string): Promise<AdaptedCube>;
  fetchCubes(): Promise<AdaptedCube[]>;
  fetchMember(
    parent: Level | LevelDescriptor,
    key: string | number,
    options?: any
  ): Promise<AdaptedMember>;
  fetchMembers(parent: Level | LevelDescriptor, options?: any): Promise<AdaptedMember[]>;
  serverOnline: boolean;
  serverSoftware: string;
  serverVersion: string;
  serverUrl: string;
}

export interface IFullNamed extends INamed {
  readonly caption?: string;
  readonly fullName?: string;
  readonly splitFullName?: string[];
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
