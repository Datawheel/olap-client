import Axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import formUrlDecoded from "form-urldecoded";
import formUrlEncoded from "form-urlencoded";
import urljoin from "url-join";
import { Aggregation, IDataSource, ServerStatus } from "../interfaces/contracts";
import { Format } from "../interfaces/enums";
import { PlainCube, PlainMember } from "../interfaces/plain";
import { Level } from "../level";
import { Query } from "../query";
import { applyParseUrlRules, ParseURLOptions } from "../toolbox/client";
import { ServerError } from "../toolbox/errors";
import { extractAggregateSearchParamsFromQuery, hydrateQueryFromAggregateSearchParams } from "./aggregate";
import { cubeAdapterFactory, memberAdapterFactory } from "./dataadapter";
import { MondrianAggregateURLSearchParams } from "./interfaces";
import { MondrianCube, MondrianMember } from "./schema";


export class MondrianDataSource implements IDataSource {
  private _axios: AxiosInstance = Axios.create({});
  serverOnline: boolean;
  serverSoftware: string = MondrianDataSource.softwareName;
  serverVersion: string = "";
  serverUrl: string = "/";

  static softwareName = "mondrian-rest";

  constructor(serverUrl: string) {
    if (!serverUrl || typeof serverUrl !== "string") {
      throw new Error(`Invalid Mondrian REST server URL: ${serverUrl}`);
    }
    this.serverUrl = urljoin(serverUrl, "/");
  }

  checkStatus(): Promise<ServerStatus> {
    const url = urljoin(this.serverUrl, "cubes");
    return this._axios.get(url).then(
      () => {
        // mondrian-rest doesn't have a status endpoint
        this.serverOnline = true;
        this.serverVersion = "1.0.4";
        return {
          software: this.serverSoftware,
          online: this.serverOnline,
          url: this.serverUrl,
          version: this.serverVersion
        };
      },
      (err: AxiosError) => {
        this.serverOnline = false;
        throw err;
      }
    );
  }

  execQuery(query: Query, endpoint: string = "aggregate"): Promise<Aggregation> {
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
      sorted: true
    });
    return this._axios.get(url, { params }).then((response) => {
      const data = format === Format.jsonrecords ? response.data.data : response.data;
      return {
        data,
        headers: response.headers,
        query,
        status: response.status,
        url: `${url}?${searchParams}`
      };
    });
  }

  fetchCube(cubeName: string): Promise<PlainCube> {
    const url = urljoin(this.serverUrl, "cubes", cubeName);
    const cubeAdapter = cubeAdapterFactory({ server_uri: this.serverUrl });
    return this._axios.get<MondrianCube>(url).then((response) => {
      const mondrianCube = response.data;
      if (mondrianCube && typeof mondrianCube.name === "string") {
        return cubeAdapter(mondrianCube);
      }
      throw new ServerError(response);
    }, (err: AxiosError) => {
      if (err.response) {
        if (err.response.status === 404) {
          throw new ServerError(err.response, `Cube named "${cubeName}" is not available in server ${this.serverUrl}`);
        }
        throw new ServerError(err.response, err.message);
      }
      throw err;
    });
  }

  fetchCubes(): Promise<PlainCube[]> {
    const url = urljoin(this.serverUrl, "cubes");
    const cubeAdapter = cubeAdapterFactory({ server_uri: this.serverUrl });
    return this._axios.get<{ cubes: MondrianCube[] }>(url).then((response) => {
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
    options: any = {}
  ): Promise<PlainMember> {
    const { dimension, name } = parent;
    const memberAdapter = memberAdapterFactory({
      level_uri: parent.toString()
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
      member_properties: options.member_properties
    };
    return this._axios
      .get<MondrianMember>(url, { params })
      .then((response) => memberAdapter(response.data));
  }

  fetchMembers(parent: Level, options: any = {}): Promise<PlainMember[]> {
    const memberAdapter = memberAdapterFactory({
      level_uri: parent.toString()
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
      member_properties: options.member_properties
    };
    return this._axios
      .get<{ members: MondrianMember[] }>(url, { params })
      .then((response) => response.data.members.map(memberAdapter));
  }

  parseQueryURL(query: Query, url: string, options: Partial<ParseURLOptions>): Query {
    const searchIndex = url.indexOf("?");
    const searchParams = url.slice(searchIndex + 1);
    const qp: Partial<MondrianAggregateURLSearchParams> = formUrlDecoded(searchParams);

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
    Object.assign(this._axios.defaults, config);
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
      sorted: true
    });
    return urljoin(query.cube.toString(), `aggregate.${format}?${parameters}`);
  }
}
