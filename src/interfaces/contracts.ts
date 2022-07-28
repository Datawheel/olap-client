import { AxiosInstance, AxiosRequestConfig } from "axios";
import { Cube } from "../cube";
import { Level } from "../level";
import { Member } from "../member";
import { Query } from "../query";
import { ParseURLOptions } from "../toolbox/client";
import { LevelDescriptor } from "./descriptors";
import { PlainCube, PlainMember } from "./plain";

export interface Aggregation<T = any> {
  data: T;
  headers: Record<string, string>;
  query: Query;
  status?: number;
  url?: string;
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
  parseQueryURL(url: string, options?: Partial<ParseURLOptions>): Promise<Query>;
  setRequestConfig(config: AxiosRequestConfig): void;
}

export interface IDataSource {
  axiosInstance: AxiosInstance;
  checkStatus(): Promise<ServerStatus>;
  execQuery(query: Query, endpoint?: string): Promise<Aggregation>;
  fetchCube(cubeName: string): Promise<PlainCube>;
  fetchCubes(): Promise<PlainCube[]>;
  fetchMember(parent: Level, key: string | number, options?: any): Promise<PlainMember>;
  fetchMembers(parent: Level, options?: any): Promise<PlainMember[]>;
  parseQueryURL(query: Query, url: string, options: Partial<ParseURLOptions>): Query;
  serverOnline: boolean;
  serverSoftware: string;
  serverUrl: string;
  serverVersion: string;
  setRequestConfig(config: AxiosRequestConfig): void;
  stringifyQueryURL(query: Query, kind: string): string;
}

export interface ServerStatus {
  software: string;
  online: boolean;
  url: string;
  version: string;
}
