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
import { extractLogicLayerSearchParamsFromQuery, hydrateQueryFromLogicLayerSearchParams } from "./logiclayer";
import { TesseractCube, TesseractEndpointCubes, TesseractMember } from "./schema";

interface TesseractServerStatus {
  status: string;
  tesseract_version: string;
}

export class TesseractDataSource implements IDataSource {
  private _axios: AxiosInstance = Axios.create({});
  serverOnline: boolean;
  serverSoftware: string = TesseractDataSource.softwareName;
  serverVersion: string = "";
  serverUrl: string = "/";

  static softwareName = "tesseract-olap";

  constructor(serverUrl: string) {
    if (!serverUrl || typeof serverUrl !== "string") {
      throw new Error(`Invalid Tesseract OLAP server URL: ${serverUrl}`);
    }
    this.serverUrl = urljoin(serverUrl, "/");
  }

  checkStatus(): Promise<ServerStatus> {
    return this._axios.get<TesseractServerStatus>(this.serverUrl).then(
      (response) => {
        const { status, tesseract_version } = response.data;
        this.serverOnline = status === "ok";
        this.serverVersion = tesseract_version;
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
    if (endpoint === "logiclayer") {
      return this.execQueryLogicLayer(query);
    }
    const reason = `Invalid endpoint type: ${endpoint}`;
    return Promise.reject(new Error(reason));
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

  private execQueryLogicLayer(query: Query): Promise<Aggregation> {
    const params = extractLogicLayerSearchParamsFromQuery(query);
    const format = query.getParam("format");
    const url = urljoin(this.serverUrl, `data.${format}`);
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
    return this._axios.get<TesseractCube>(url).then((response) => {
      const tesseractCube = response.data;
      if (tesseractCube && typeof tesseractCube.name === "string") {
        return cubeAdapter(tesseractCube);
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
    return this._axios.get<TesseractEndpointCubes>(url).then((response) => {
      const tesseractResponse = response.data;
      if (tesseractResponse && Array.isArray(tesseractResponse.cubes)) {
        return tesseractResponse.cubes.map(cubeAdapter);
      }
      throw new ServerError(response);
    });
  }

  fetchMembers(parent: Level, options: any = {}): Promise<PlainMember[]> {
    const url = urljoin(this.serverUrl, `members`);
    const params = {
      cube: parent.cube.name,
      level: parent.name,
      locale: options.locale || undefined
    };
    const memberAdapter = memberAdapterFactory({
      level_name: params.level,
      locale: (params.locale || ``).toUpperCase(),
      server_uri: this.serverUrl
    });
    return this._axios
      .get<{ data: unknown[] }>(url, { params })
      .then((response) => {
        const {data} = response.data;
        let i = data.length;
        while (i--) {
          data[i] = memberAdapter(data[i] as TesseractMember);
        }
        return data as PlainMember[];
      });
  }

  fetchMember(
    parent: Level,
    key: string | number,
    options: any = {}
  ): Promise<PlainMember> {
    // Tesseract OLAP servers don't support retrieving one member.
    // We're going to get all of them, and return only the right one.
    return this.fetchMembers(parent, options).then((members) => {
      const member = members.find((member: PlainMember) => member.key == key);
      if (member) {
        return member;
      }
      throw new Error(
        `Requested member doesn't exist: descriptor ${JSON.stringify(parent)}, key ${key}`
      );
    });
  }

  parseQueryURL(query: Query, url: string, options: Partial<ParseURLOptions>): Query {
    const searchIndex = url.indexOf("?");
    const searchParams = url.slice(searchIndex + 1);
    const qp = formUrlDecoded(searchParams);

    const formatMatch = url.match(/^.+\/(?:aggregate|data)(\.[a-z]+)?\?.+$/);
    if (formatMatch) {
      const strFormat = `${formatMatch[1] || ""}`.slice(1);
      query.setFormat(strFormat as Format);
    }

    const qpFinal = applyParseUrlRules(qp, options);

    if (url.indexOf("/aggregate") > -1) {
      return hydrateQueryFromAggregateSearchParams(query, qpFinal);
    }

    if (url.indexOf("/data") > -1) {
      if (qp.cube !== query.cube.name) {
        throw new Error(
          `URL and Query object belong to different cubes
  Query cube: ${query.cube.name}
  URL cube: ${qp.cube}`
        );
      }
      return hydrateQueryFromLogicLayerSearchParams(query, qpFinal);
    }

    throw new Error(`Provided URL is not a valid Tesseract OLAP query URL: ${url}`);
  }

  setRequestConfig(config: AxiosRequestConfig): void {
    Object.assign(this._axios.defaults, config);
  }

  stringifyQueryURL(query: Query, kind: string): string {
    if (kind === "logiclayer") {
      return TesseractDataSource.urlLogicLayer(query);
    }
    return TesseractDataSource.urlAggregate(query);
  }

  static queryAggregate = hydrateQueryFromAggregateSearchParams;

  static queryLogicLayer = hydrateQueryFromLogicLayerSearchParams;

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

  static urlLogicLayer(query: Query): string {
    const format = query.getParam("format");
    const paramObject = extractLogicLayerSearchParamsFromQuery(query);
    const parameters = formUrlEncoded(paramObject, {
      ignorenull: true,
      skipIndex: true,
      sorted: true
    });
    return urljoin(query.cube.server, `data.${format}?${parameters}`);
  }
}
