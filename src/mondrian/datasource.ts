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
import {ensureArray} from "../utils";
import {aggregateQueryBuilder} from "./aggregate";
import {cubeAdapterFactory, memberAdapterFactory} from "./dataadapter";
import {MondrianCube, MondrianMember} from "./schema";

export class MondrianDataSource implements IDataSource {
  serverOnline: boolean;
  serverSoftware: string = MondrianDataSource.softwareName;
  serverVersion: string = "";
  serverUrl: string = "/";

  static softwareName = "mondrian-rest";

  constructor(serverUrl: string) {
    if (!serverUrl) {
      throw new ClientError(`Invalid Mondrian REST server URL: ${serverUrl}`);
    }
    this.serverUrl = serverUrl;
  }

  checkStatus(): Promise<ServerStatus> {
    const url = urljoin(this.serverUrl, "cubes");
    return Axios.get(url).then(
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
    parent: Level,
    key: number | string,
    options: any = {}
  ): Promise<AdaptedMember> {
    const {dimension, name} = parent;
    const memberAdapter = memberAdapterFactory({
      level_uri: parent.toString()
    });

    const captions: string[] = ensureArray(options.caption);
    if (options.locale) {
      const localeKey = `${options.locale.slice(0, 2)}_caption`;
      const localeCaption = parent.annotations[localeKey];
      localeCaption && captions.push(localeCaption);
    }

    const url = urljoin(dimension.toString(), "levels", name, "members", `${key}`);
    const params = {
      caption: captions.length ? captions : undefined,
      children: Boolean(options.children),
      member_properties: options.member_properties
    };
    return Axios.get<MondrianMember>(url, {params}).then(response =>
      memberAdapter(response.data)
    );
  }

  fetchMembers(parent: Level, options: any = {}): Promise<AdaptedMember[]> {
    const memberAdapter = memberAdapterFactory({
      level_uri: parent.toString()
    });

    const captions: string[] = ensureArray(options.caption);
    if (options.locale) {
      const localeKey = `${options.locale.slice(0, 2)}_caption`;
      const localeCaption = parent.annotations[localeKey];
      localeCaption && captions.push(localeCaption);
    }

    const url = urljoin(parent.toString(), "members");
    const params = {
      caption: captions.length ? captions : undefined,
      children: Boolean(options.children),
      member_properties: options.member_properties
    };
    return Axios.get<{members: MondrianMember[]}>(url, {params}).then(response =>
      response.data.members.map(memberAdapter)
    );
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
}
