import Axios, {type AxiosInstance, type AxiosRequestConfig} from "axios";
import formUrlDecode from "form-urldecoded";
import formUrlEncode from "form-urlencoded";
import urljoin from "url-join";
import type {Aggregation, IDataSource, ServerStatus} from "../interfaces/contracts";
import {Format} from "../interfaces/enums";
import type {PlainCube, PlainMember} from "../interfaces/plain";
import type {Level} from "../level";
import type {Query} from "../query";
import {type ParseURLOptions, applyParseUrlRules} from "../toolbox/client";
import {
  buildSearchParams,
  cubeAdapter,
  hydrateQueryFromRequest,
  isDataRequest,
  memberAdapter,
} from "./adapter";
import type {
  TesseractCube,
  TesseractDataResponse,
  TesseractMembersRequest,
  TesseractMembersResponse,
  TesseractSchema,
  TesseractStatus,
} from "./schema";

const softwareName = "tesseract-olap[python]";

export enum PyTesseractEndpoint {
  logiclayer = "",
}

export class PyTesseractDataSource implements IDataSource {
  axiosInstance: AxiosInstance;
  serverOnline = false;
  serverSoftware = softwareName;
  serverUrl: string;
  serverVersion: string;

  static endpoints = [PyTesseractEndpoint.logiclayer];
  static formats = [
    Format.csv,
    Format.tsv,
    Format.jsonarrays,
    Format.jsonrecords,
    Format.xlsx,
  ];
  static softwareName = softwareName;

  constructor(url: string) {
    if (!url || typeof url !== "string") {
      throw new TypeError(`Invalid tesseract-olap server URL: ${url}`);
    }
    this.serverUrl = urljoin(url, "/");
    this.axiosInstance = Axios.create({baseURL: this.serverUrl});
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
    const format = query.getParam("format");
    const url = this.stringifyQueryURL(query);
    return this.axiosInstance.get<TesseractDataResponse>(url).then((response) => {
      return {
        data: format.startsWith("json") ? response.data.data : response.data,
        headers: {...response.headers} as Record<string, string>,
        query,
        status: response.status,
        url,
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

  fetchMember(
    parent: Level,
    key: string | number,
    options: Record<string, unknown> = {},
  ): Promise<PlainMember> {
    const params: TesseractMembersRequest = {
      cube: parent.cube.name,
      level: parent.name,
      limit: "1",
      locale: options.locale as string | undefined,
      parents: options.parents as boolean | undefined,
      search: `${key}`,
    };
    return this.axiosInstance
      .get<TesseractMembersResponse>("members", {params})
      .then((response) => {
        // biome-ignore lint/suspicious/noDoubleEquals: need to compare as number or string
        const member = response.data.members.find((item) => item.key == key);
        if (member) {
          return memberAdapter.call(parent, member);
        }
        throw new Error(`Can't find member with key '${key}' for level '${parent.name}'`);
      });
  }

  fetchMembers(
    parent: Level,
    options: Record<string, unknown> = {},
  ): Promise<PlainMember[]> {
    const params: TesseractMembersRequest = {
      cube: parent.cube.name,
      level: parent.name,
      limit: options.limit as string | undefined,
      locale: options.locale as string | undefined,
      parents: options.parents as boolean | undefined,
      search: options.search as string | undefined,
    };
    return this.axiosInstance
      .get<TesseractMembersResponse>("members", {params})
      .then((response) => response.data.members.map(memberAdapter, parent));
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

  stringifyQueryURL(query: Query): string {
    const format = query.getParam("format") || Format.jsonrecords;
    const urlSearchParams = buildSearchParams(query);
    const urlSearch = formUrlEncode(urlSearchParams, {
      ignoreEmptyArray: true,
      ignorenull: true,
      skipBracket: true,
      skipIndex: true,
      sorted: true,
    });
    return urljoin(this.serverUrl, `data.${format}?${urlSearch}`);
  }
}
