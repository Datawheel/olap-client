import Axios, {AxiosError} from "axios";
import formUrlDecoded from "form-urldecoded";
import formUrlEncoded from "form-urlencoded";
import urljoin from "url-join";
import {Format} from "../enums";
import {ClientError, ServerError} from "../errors";
import {
  AdaptedCube,
  AdaptedMember,
  Aggregation,
  IDataSource,
  ParseURLOptions,
  ServerStatus
} from "../interfaces";
import Level from "../level";
import {Query} from "../query";
import {applyParseUrlRules} from "../utils";
import {aggregateQueryBuilder, aggregateQueryParser} from "./aggregate";
import {cubeAdapterFactory, memberAdapterFactory} from "./dataadapter";
import {MondrianAggregateURLSearchParams} from "./interfaces";
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
    const searchParams = formUrlEncoded(params, {
      ignorenull: true,
      skipIndex: true,
      sorted: true
    });
    return Axios.get(url, {params}).then(response => {
      const data = format === Format.jsonrecords ? response.data.data : response.data;
      return {data, query, status: response.status, url: `${url}?${searchParams}`};
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
    return Axios.get<MondrianMember>(url, {params}).then(response =>
      memberAdapter(response.data)
    );
  }

  fetchMembers(parent: Level, options: any = {}): Promise<AdaptedMember[]> {
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
    return Axios.get<{members: MondrianMember[]}>(url, {params}).then(response =>
      response.data.members.map(memberAdapter)
    );
  }

  parseQueryURL(query: Query, url: string, options: Partial<ParseURLOptions>) {
    const searchIndex = url.indexOf("?");
    const searchParams = url.slice(searchIndex + 1);
    const qp: MondrianAggregateURLSearchParams = formUrlDecoded(searchParams);

    const formatMatch = url.match(/^.+\/aggregate(\.[a-z]+)\?.+$/);
    if (formatMatch) {
      qp["format"] = formatMatch[1].slice(1);
    }

    const qpFinal = applyParseUrlRules(qp, options);

    if (url.indexOf("/aggregate") > -1) {
      return MondrianDataSource.queryAggregate(query, qpFinal);
    }

    throw new ClientError(`Provided URL is not a valid Mondrian REST query URL: ${url}`);
  }

  stringifyQueryURL(query: Query): string {
    return MondrianDataSource.urlAggregate(query);
  }

  static queryAggregate(query: Query, params: Partial<MondrianAggregateURLSearchParams>): Query {
    return aggregateQueryParser(query, params);
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
