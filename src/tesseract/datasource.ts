import Axios, {AxiosError} from "axios";
import formUrlEncoded from "form-urlencoded";
import urljoin from "url-join";
import {Format} from "../enums";
import {ClientError, ServerError} from "../errors";
import {
  AdaptedCube,
  AdaptedMember,
  Aggregation,
  IDataSource,
  ServerStatus
} from "../interfaces";
import Level from "../level";
import {Query} from "../query";
import {cubeAdapterFactory, memberAdapterFactory} from "./dataadapter";
import {TesseractCube, TesseractEndpointCubes, TesseractMember} from "./schema";
import {aggregateQueryBuilder, logicLayerQueryBuilder} from "./utils";

interface TesseractServerStatus {
  status: string;
  tesseract_version: string;
}

export class TesseractDataSource implements IDataSource {
  serverOnline: boolean;
  serverSoftware: string = TesseractDataSource.softwareName;
  serverVersion: string = "";
  serverUrl: string = "/";

  static softwareName = "tesseract-olap";

  constructor(serverUrl: string) {
    if (!serverUrl) {
      throw new ClientError(`Invalid Tesseract OLAP server URL: ${serverUrl}`);
    }
    this.serverUrl = serverUrl;
  }

  checkStatus(): Promise<ServerStatus> {
    return Axios.get<TesseractServerStatus>(this.serverUrl).then(
      response => {
        const {status, tesseract_version} = response.data;
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
    throw new ClientError(`Invalid endpoint type: ${endpoint}`);
  }

  private execQueryAggregate(query: Query): Promise<Aggregation> {
    const params = aggregateQueryBuilder(query);
    const format = query.getParam("format");
    const url = urljoin(query.cube.toString(), `aggregate.${format}`);
    return Axios.get(url, {params}).then(response => {
      const data = format === Format.jsonrecords ? response.data.data : response.data;
      return {data, query, status: response.status, url: `${response.config.url}`};
    });
  }

  private execQueryLogicLayer(query: Query): Promise<Aggregation> {
    const params = logicLayerQueryBuilder(query);
    const format = query.getParam("format");
    const url = urljoin(this.serverUrl, `data.${format}`);
    return Axios.get(url, {params}).then(response => {
      const data = format === Format.jsonrecords ? response.data.data : response.data;
      return {data, query, status: response.status, url: `${response.config.url}`};
    });
  }

  fetchCube(cubeName: string): Promise<AdaptedCube> {
    const url = urljoin(this.serverUrl, "cubes", cubeName);
    const cubeAdapter = cubeAdapterFactory({server_uri: this.serverUrl});
    return Axios.get<TesseractCube>(url).then(response => {
      const tesseractCube = response.data;
      if (tesseractCube && typeof tesseractCube.name === "string") {
        return cubeAdapter(tesseractCube);
      }
      throw new ServerError(response);
    });
  }

  fetchCubes(): Promise<AdaptedCube[]> {
    const url = urljoin(this.serverUrl, "cubes");
    const cubeAdapter = cubeAdapterFactory({server_uri: this.serverUrl});
    return Axios.get<TesseractEndpointCubes>(url).then(response => {
      const tesseractResponse = response.data;
      if (tesseractResponse && Array.isArray(tesseractResponse.cubes)) {
        return tesseractResponse.cubes.map(cubeAdapter);
      }
      throw new ServerError(response);
    });
  }

  fetchMembers(parent: Level, options: any = {}): Promise<AdaptedMember[]> {
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
    return Axios.get<{data: TesseractMember[]}>(url, {params}).then(response =>
      response.data.data.map(memberAdapter)
    );
  }

  fetchMember(
    parent: Level,
    key: string | number,
    options: any = {}
  ): Promise<AdaptedMember> {
    // Tesseract OLAP servers don't support retrieving one member.
    // We're going to get all of them, and return only the right one.
    return this.fetchMembers(parent, options).then(members => {
      const member = members.find((member: AdaptedMember) => member.key == key);
      if (member) {
        return member;
      }
      throw new ClientError(
        `Requested member doesn't exist: descriptor ${JSON.stringify(parent)}, key ${key}`
      );
    });
  }

  static urlAggregate(query: Query): string {
    const format = query.getParam("format");
    const paramObject = aggregateQueryBuilder(query);
    const parameters = formUrlEncoded(paramObject, {
      ignorenull: true,
      skipIndex: true,
      sorted: true
    });
    return urljoin(query.cube.toString(), `aggregate.${format}?${parameters}`);
  }

  static urlLogicLayer(query: Query): string {
    const format = query.getParam("format");
    const paramObject = logicLayerQueryBuilder(query);
    const parameters = formUrlEncoded(paramObject, {
      ignorenull: true,
      skipIndex: true,
      sorted: true
    });
    return urljoin(query.cube.server, `data.${format}?${parameters}`);
  }
}
