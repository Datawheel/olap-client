import Axios, {AxiosError, AxiosResponse} from "axios";
import formUrlEncoded from "form-urlencoded";
import urljoin from "url-join";
import {Format} from "../enums";
import {ClientError, ServerError} from "../errors";
import {
  AdaptedCube,
  AdaptedMember,
  Aggregation,
  IDataSource,
  LevelDescriptor,
  ServerStatus
} from "../interfaces";
import {Query} from "../query";
import {cubeAdapterFactory, memberAdapterFactory} from "./dataadapter";
import {MondrianCube, MondrianMember} from "./schema";
import {queryBuilder} from "./utils";

interface MondrianServerStatus {
  status: string;
  mondrian_rest: string;
}

export class MondrianDataSource implements IDataSource {
  serverOnline: boolean;
  serverSoftware: string = "mondrian-rest";
  serverVersion: string = "";
  serverUrl: string = "/";

  constructor(serverUrl: string) {
    if (!serverUrl) {
      throw new ClientError(`Invalid Mondrian REST server URL: ${serverUrl}`);
    }
    this.serverUrl = serverUrl;
  }

  checkStatus(): Promise<ServerStatus> {
    return Axios.get<MondrianServerStatus>(this.serverUrl).then(
      (response: AxiosResponse<MondrianServerStatus>) => {
        const {status, mondrian_rest} = response.data;
        this.serverOnline = status === "ok";
        this.serverVersion = mondrian_rest;
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
    throw new ClientError(`Invalid endpoint type: ${endpoint}`);
  }

  private execQueryAggregate(query: Query): Promise<Aggregation> {
    const params = queryBuilder(query);
    const format = query.getParam("format");
    const url = urljoin(query.cube.toString(), `aggregate.${format}`);
    return Axios.get(url, {params}).then(response => {
      const data = format === Format.jsonrecords ? response.data.data : response.data;
      return {data, query, status: response.status, url: `${response.config.url}`};
    });
  }

  fetchCube(cubeName: string): Promise<AdaptedCube> {
    const url = urljoin(this.serverUrl, "cubes", cubeName);
    const cubeAdapter = cubeAdapterFactory({server_uri: this.serverUrl});
    return Axios.get<MondrianCube>(url).then(response => {
      const mondrianCube = response.data;
      if (mondrianCube && typeof mondrianCube.name === "string") {
        return cubeAdapter(mondrianCube);
      }
      throw new ServerError(response);
    });
  }

  fetchCubes(): Promise<AdaptedCube[]> {
    const url = urljoin(this.serverUrl, "cubes");
    const cubeAdapter = cubeAdapterFactory({server_uri: this.serverUrl});
    return Axios.get<{cubes: MondrianCube[]}>(url).then(response => {
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
    parent: LevelDescriptor,
    key: number | string,
    options: any = {}
  ): Promise<AdaptedMember> {
    if (!parent || !parent.cube || !parent.dimension || !parent.level) {
      const descriptor = JSON.stringify(parent);
      throw new ClientError(
        `Level descriptor must specify cube, dimension, level: ${descriptor}`
      );
    }
    const url = urljoin(
      this.serverUrl,
      "cubes",
      parent.cube,
      "dimensions",
      parent.dimension,
      "levels",
      parent.level,
      "members",
      `${key}`
    );
    const params = {
      children: Boolean(options.children),
      caption: options.caption,
      member_properties: options.member_properties
    };
    const memberAdapter = memberAdapterFactory({server_uri: this.serverUrl});
    return Axios.get<MondrianMember>(url, {params}).then(response =>
      memberAdapter(response.data)
    );
  }

  fetchMembers(parent: LevelDescriptor, options: any = {}): Promise<AdaptedMember[]> {
    if (
      !parent ||
      !parent.cube ||
      !parent.dimension ||
      !parent.hierarchy ||
      !parent.level
    ) {
      const descriptor = JSON.stringify(parent);
      throw new ClientError(
        `Level descriptor must specify cube, dimension, hierarchy, level: ${descriptor}`
      );
    }
    const url = urljoin(
      this.serverUrl,
      "cubes",
      parent.cube,
      "dimensions",
      parent.dimension,
      "hierarchies",
      parent.hierarchy,
      "levels",
      parent.level,
      "members"
    );
    const params = {
      children: Boolean(options.children),
      caption: options.caption,
      member_properties: options.member_properties
    };
    const memberAdapter = memberAdapterFactory({server_uri: this.serverUrl});
    return Axios.get<{members: MondrianMember[]}>(url, {params}).then(response =>
      response.data.members.map(memberAdapter)
    );
  }

  static urlAggregate(query: Query): string {
    const format = query.getParam("format");
    const paramObject = queryBuilder(query);
    const parameters = formUrlEncoded(paramObject, {
      ignorenull: true,
      skipIndex: true,
      sorted: true
    });
    return urljoin(query.cube.toString(), `aggregate.${format}?${parameters}`);
  }
}
