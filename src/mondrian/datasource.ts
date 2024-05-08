import Axios, {type AxiosError, type AxiosInstance, type AxiosRequestConfig} from "axios";
import formUrlDecoded from "form-urldecoded";
import formUrlEncoded from "form-urlencoded";
import urljoin from "url-join";
import type {Aggregation, IDataSource, ServerStatus} from "../interfaces/contracts";
import {Format} from "../interfaces/enums";
import type {PlainCube, PlainMember} from "../interfaces/plain";
import type {Level} from "../level";
import type {Query} from "../query";
import {type ParseURLOptions, applyParseUrlRules} from "../toolbox/client";
import {ServerError} from "../toolbox/errors";
import {
  extractAggregateSearchParamsFromQuery,
  hydrateQueryFromAggregateSearchParams,
} from "./aggregate";
import {cubeAdapterFactory, memberAdapterFactory} from "./dataadapter";
import type {MondrianAggregateURLSearchParams} from "./interfaces";
import type {MondrianCube, MondrianMember} from "./schema";

const softwareName = "mondrian-rest";

export enum MondrianEndpoint {
  aggregate = "",
}

export class MondrianDataSource implements IDataSource {
  axiosInstance: AxiosInstance;
  serverOnline = false;
  serverSoftware = softwareName;
  serverUrl: string;
  serverVersion: string;

  static endpoints = [MondrianEndpoint.aggregate];
  static formats = [Format.csv, Format.json, Format.jsonrecords, Format.xls];
  static softwareName = softwareName;

  constructor(serverUrl: string) {
    if (!serverUrl || typeof serverUrl !== "string") {
      throw new Error(`Invalid Mondrian REST server URL: ${serverUrl}`);
    }
    this.serverUrl = urljoin(serverUrl, "/");
    this.axiosInstance = Axios.create({baseURL: this.serverUrl});
  }

  checkStatus(): Promise<ServerStatus> {
    const url = urljoin(this.serverUrl, "cubes");
    return this.axiosInstance.get(url).then(
      () => {
        // mondrian-rest doesn't have a status endpoint
        this.serverOnline = true;
        this.serverVersion = "1.0.4";
        return {
          software: softwareName,
          online: this.serverOnline,
          url: this.serverUrl,
          version: this.serverVersion,
        };
      },
      (err: AxiosError) => {
        this.serverOnline = false;
        throw err;
      },
    );
  }

  execQuery(query: Query, endpoint = "aggregate"): Promise<Aggregation> {
    if (endpoint === "aggregate") {
      return this.execQueryAggregate(query);
    }
    return Promise.reject(new Error(`Invalid endpoint type: ${endpoint}`));
  }

  private execQueryAggregate(query: Query): Promise<Aggregation> {
    const params = extractAggregateSearchParamsFromQuery(query);
    const format = query.getParam("format");
    const url = urljoin(query.cube.toString(), `aggregate.${format}`);
    const searchParams = formUrlEncoded(params, {
      ignorenull: true,
      skipIndex: true,
      sorted: true,
    });
    return this.axiosInstance.get(url, {params}).then((response) => {
      const data = format === Format.jsonrecords ? response.data.data : response.data;
      return {
        data,
        headers: {...response.headers} as Record<string, string>,
        query,
        status: response.status,
        url: `${url}?${searchParams}`,
      };
    });
  }

  fetchCube(cubeName: string): Promise<PlainCube> {
    const url = urljoin(this.serverUrl, "cubes", cubeName);
    const cubeAdapter = cubeAdapterFactory({server_uri: this.serverUrl});
    return this.axiosInstance.get<MondrianCube>(url).then(
      (response) => {
        const mondrianCube = response.data;
        if (mondrianCube && typeof mondrianCube.name === "string") {
          return cubeAdapter(mondrianCube);
        }
        throw new ServerError(response);
      },
      (err: AxiosError) => {
        if (err.response) {
          if (err.response.status === 404) {
            throw new ServerError(
              err.response,
              `Cube named "${cubeName}" is not available in server ${this.serverUrl}`,
            );
          }
          throw new ServerError(err.response, err.message);
        }
        throw err;
      },
    );
  }

  fetchCubes(): Promise<PlainCube[]> {
    const url = urljoin(this.serverUrl, "cubes");
    const cubeAdapter = cubeAdapterFactory({server_uri: this.serverUrl});
    return this.axiosInstance.get<{cubes: MondrianCube[]}>(url).then((response) => {
      const mondrianResponse = response.data;
      if (mondrianResponse && Array.isArray(mondrianResponse.cubes)) {
        return mondrianResponse.cubes.map(cubeAdapter);
      }
      throw new ServerError(response);
    });
  }

  /**
   * The output of this endpoint is restricted to the first hierarchy.
   * @see [Source code](https://github.com/jazzido/mondrian-rest/blob/public/lib/mondrian_rest/api.rb#L220)
   */
  fetchMember(
    parent: Level,
    key: number | string,
    options: any = {},
  ): Promise<PlainMember> {
    const {dimension, name} = parent;
    const memberAdapter = memberAdapterFactory({
      level_uri: parent.toString(),
    });

    let caption: string = options.caption;
    if (options.locale) {
      const localeCode = options.locale.slice(0, 2);
      caption =
        parent.annotations[`${localeCode}_caption`] ||
        parent.annotations[`caption_${localeCode}`] ||
        caption;
    }

    const url = urljoin(dimension.toString(), "levels", name, "members", `${key}`);
    const params = {
      caption: caption || undefined,
      children: Boolean(options.children),
      member_properties: options.member_properties,
    };
    return this.axiosInstance.get<MondrianMember>(url, {params}).then(
      (response) => memberAdapter(response.data),
      (err) => {
        if (err.status === 404) {
          throw new Error(
            `Can't find member with key '${key}' for level '${parent.name}'`,
          );
        }
        throw err;
      },
    );
  }

  fetchMembers(parent: Level, options: any = {}): Promise<PlainMember[]> {
    const memberAdapter = memberAdapterFactory({
      level_uri: parent.toString(),
    });

    let caption: string = options.caption;
    if (options.locale) {
      const localeCode = options.locale.slice(0, 2);
      caption =
        parent.annotations[`${localeCode}_caption`] ||
        parent.annotations[`caption_${localeCode}`] ||
        caption;
    }

    const url = urljoin(parent.toString(), "members");
    const params = {
      caption: caption || undefined,
      children: Boolean(options.children),
      member_properties: options.member_properties,
    };
    return this.axiosInstance
      .get<{members: MondrianMember[]}>(url, {params})
      .then((response) => response.data.members.map(memberAdapter));
  }

  parseQueryURL(query: Query, url: string, options: Partial<ParseURLOptions>): Query {
    const searchIndex = url.indexOf("?");
    const searchParams = url.slice(searchIndex + 1);
    const qp: Partial<MondrianAggregateURLSearchParams & {format: string}> =
      formUrlDecoded(searchParams);

    const formatMatch = url.match(/^.+\/aggregate(\.[a-z]+)\?.+$/);
    if (formatMatch) {
      qp["format"] = formatMatch[1].slice(1);
    }

    const qpFinal = applyParseUrlRules(qp, options);

    if (url.indexOf("/aggregate") > -1) {
      return hydrateQueryFromAggregateSearchParams(query, qpFinal);
    }

    throw new Error(`Provided URL is not a valid Mondrian REST query URL: ${url}`);
  }

  setRequestConfig(config: AxiosRequestConfig): void {
    Object.assign(this.axiosInstance.defaults, config);
  }

  stringifyQueryURL(query: Query): string {
    return MondrianDataSource.urlAggregate(query);
  }

  static queryAggregate = hydrateQueryFromAggregateSearchParams;

  static urlAggregate(query: Query): string {
    const format = query.getParam("format");
    const paramObject = extractAggregateSearchParamsFromQuery(query);
    const parameters = formUrlEncoded(paramObject, {
      ignorenull: true,
      skipIndex: true,
      sorted: true,
    });
    return urljoin(query.cube.toString(), `aggregate.${format}?${parameters}`);
  }
}
