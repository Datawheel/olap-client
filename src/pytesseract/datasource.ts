import Axios, {type AxiosInstance, type AxiosRequestConfig} from "axios";
import type {Aggregation, IDataSource, ServerStatus} from "../interfaces/contracts";
import type {
  TesseractCube,
  TesseractDataResponse,
  TesseractMembersRequest,
  TesseractMembersResponse,
  TesseractSchema,
  TesseractStatus,
} from "./schema";
import type {Query} from "../query";
import {
  buildSearchParams,
  cubeAdapter,
  hydrateQueryFromRequest,
  isDataRequest,
  memberAdapter,
  stringifyRequest,
} from "./adapter";
import type {PlainCube, PlainMember} from "../interfaces/plain";
import type {Level} from "../level";
import {filterMap} from "../toolbox/collection";
import {type ParseURLOptions, applyParseUrlRules} from "../toolbox/client";
import urljoin from "url-join";
import formUrlDecode from "form-urldecoded";
import type {Format} from "../interfaces/enums";

const softwareName = "python:tesseract-olap";

export class TesseractDataSource implements IDataSource {
  axiosInstance: AxiosInstance;
  serverOnline = false;
  serverSoftware = softwareName;
  serverUrl: string;
  serverVersion: string;

  static softwareName = softwareName;

  constructor(baseURL: string) {
    if (!baseURL || typeof baseURL !== "string") {
      throw new TypeError(`Invalid tesseract-olap server URL: ${baseURL}`);
    }
    this.axiosInstance = Axios.create({baseURL});
    this.serverUrl = baseURL;
  }

  checkStatus(): Promise<ServerStatus> {
    return this.axiosInstance.get<TesseractStatus>("/").then(
      (response) => {
        const {version} = response.data;
        this.serverOnline = true;
        this.serverVersion = version;
        return {
          software: softwareName,
          online: this.serverOnline,
          url: this.serverUrl,
          version: version,
        };
      },
      (error) => {
        this.serverOnline = false;
        throw error;
      },
    );
  }

  execQuery(query: Query): Promise<Aggregation> {
    const params = buildSearchParams(query);
    return this.axiosInstance
      .get<TesseractDataResponse>("data.jsonarrays", {params})
      .then((response) => {
        const {columns, data} = response.data;
        return {
          data: data.map((item) =>
            Object.fromEntries(columns.map((name, i) => [name, item[i]])),
          ),
          headers: {...response.headers} as Record<string, string>,
          query,
          status: response.status,
          url: response.request.url,
        };
      });
  }

  fetchCube(cubeName: string): Promise<PlainCube> {
    const ctx = {uri: this.serverUrl};
    return this.axiosInstance
      .get<TesseractCube>(`cubes/${encodeURIComponent(cubeName)}`)
      .then((response) => cubeAdapter.call(ctx, response.data));
  }

  fetchCubes(): Promise<PlainCube[]> {
    const ctx = {uri: this.serverUrl};
    return this.axiosInstance
      .get<TesseractSchema>("cubes")
      .then((response) => response.data.cubes.map(cubeAdapter, ctx));
  }

  fetchMember(parent: Level, key: string | number, options?: any): Promise<PlainMember> {
    const params: TesseractMembersRequest = {
      cube: parent.cube.name,
      level: parent.name,
      limit: "1",
      locale: options.locale,
      parents: options.parents,
      search: `${key}`,
    };
    return this.axiosInstance.get<TesseractMembersResponse>("members", {params}).then(
      (response) =>
        filterMap(response.data.members, (item) =>
          // biome-ignore lint/suspicious/noDoubleEquals: need to compare as number or string
          item.key == key ? memberAdapter.call(response.data, item) : null,
        )[0],
    );
  }

  fetchMembers(parent: Level, options?: any): Promise<PlainMember[]> {
    const params: TesseractMembersRequest = {
      cube: parent.cube.name,
      level: parent.name,
      limit: options.limit,
      locale: options.locale,
      parents: options.parents,
      search: options.search,
    };
    return this.axiosInstance
      .get<TesseractMembersResponse>("members", {params})
      .then((response) => response.data.members.map(memberAdapter, response.data));
  }

  parseQueryURL(query: Query, url: string, options: Partial<ParseURLOptions>): Query {
    const searchIndex = url.indexOf("?");
    const searchParams = searchIndex > -1 ? url.slice(searchIndex + 1) : url;
    const request = formUrlDecode(searchParams);

    if (isDataRequest(request)) {
      const filteredRequest = applyParseUrlRules(request, options);
      hydrateQueryFromRequest(query, filteredRequest);

      const formatMatch = url.match(/^.+\/data\.([a-z]+)\?.+$/);
      if (formatMatch) {
        query.setFormat(formatMatch[1] as Format);
      }

      return query;
    }

    throw new Error(`Provided URL is not a valid tesseract-olap REST query URL: ${url}`);
  }

  setRequestConfig(config: AxiosRequestConfig): void {
    Object.assign(this.axiosInstance.defaults, config);
  }

  stringifyQueryURL(query: Query, kind = "jsonarrays"): string {
    const request = buildSearchParams(query);
    return urljoin(this.serverUrl, `data.${kind}?${stringifyRequest(request)}`);
  }
}
