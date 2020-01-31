import Axios, {AxiosError, AxiosRequestConfig, AxiosResponse} from "axios";
import urljoin from "url-join";
import Cube from "./cube";
import {ClientError, ServerError} from "./errors";
import {
  AdaptedCube,
  Aggregation,
  IClient,
  IDataSource,
  LevelDescriptor,
  ParseURLOptions,
  ServerStatus
} from "./interfaces";
import Level from "./level";
import Member from "./member";
import {MondrianDataSource} from "./mondrian/datasource";
import {Query} from "./query";
import {TesseractDataSource} from "./tesseract/datasource";
import {levelFinderFactory} from "./utils";

export class Client implements IClient {
  private _cubeCache: {[key: string]: Promise<Cube>} = {};
  private _cubesCache: Promise<Cube[]> | undefined = undefined;
  private _ds: IDataSource | undefined;

  static dataSourceFromURL(
    config: string | AxiosRequestConfig
  ): Promise<IDataSource> {
    if (typeof config === "string") {
      config = { url: config };
    }
    const { url, ...reqConfig } = config;

    if (!url) {
      throw new ClientError(`DataSource can be built with a string URL or an object with a url property.
Received ${JSON.stringify(config)}`);
    }

    const cubesUrl = urljoin(url, "cubes");
    return Axios({ ...reqConfig, url: cubesUrl }).then(
      (response: AxiosResponse) => {
        if (response.status === 200 && "cubes" in response.data) {
          const ds =
            "name" in response.data
              ? new TesseractDataSource(url)
              : new MondrianDataSource(url);
          ds.setRequestConfig(reqConfig);
          return ds;
        }
        throw new ServerError(
          response,
          `URL is not a known OLAP server: ${url}`
        );
      },
      (error: AxiosError) => {
        error.message += `\nURL is not a known OLAP server: ${url}`;
        throw error;
      }
    );
  }

  static fromURL(url: string | AxiosRequestConfig): Promise<Client> {
    return Client.dataSourceFromURL(url).then(
      datasource => new Client(datasource)
    );
  }

  constructor(datasource?: IDataSource) {
    datasource && this.setDataSource(datasource);
  }

  private cacheCube(cube: Cube): Cube {
    this._cubeCache[cube.name] = Promise.resolve(cube);
    return cube;
  }

  checkStatus(): Promise<ServerStatus> {
    return this.datasource.checkStatus();
  }

  private get datasource(): IDataSource {
    if (!this._ds) {
      throw new ClientError(`This Client instance has no DataSource configured.
Verify the initialization procedure, there might be a race condition.`);
    }
    return this._ds;
  }

  execQuery(query: Query, endpoint?: string): Promise<Aggregation> {
    return this.datasource.execQuery(query, endpoint);
  }

  getCube(cubeName: string): Promise<Cube> {
    const datasource = this.datasource;
    const promise =
      this._cubeCache[cubeName] ||
      datasource.fetchCube(cubeName).then((acube: AdaptedCube) => {
        const cube = new Cube(acube, datasource);
        return this.cacheCube(cube);
      });
    this._cubeCache[cubeName] = promise;
    return promise;
  }

  getCubes(): Promise<Cube[]> {
    const datasource = this.datasource;
    const promise =
      this._cubesCache ||
      datasource.fetchCubes().then((acubes: AdaptedCube[]) =>
        acubes.map(acube => {
          const cube = new Cube(acube, datasource);
          return this.cacheCube(cube);
        })
      );
    this._cubesCache = promise;
    return promise;
  }

  private getLevel(identifier: Level | LevelDescriptor): Promise<Level> {
    if (Level.isLevel(identifier)) {
      return Promise.resolve(identifier);
    }
    const levelFinder = levelFinderFactory(identifier);
    return identifier.cube
      ? this.getCube(identifier.cube).then(levelFinder)
      : this.getCubes().then(cubes => {
          for (let cube of cubes) {
            try {
              return levelFinder(cube);
            } catch (e) {
              continue;
            }
          }
          throw new ClientError(
            `No level matched the descriptor ${JSON.stringify(identifier)}`
          );
        });
  }

  getMember(
    levelRef: Level | LevelDescriptor,
    key: string | number,
    options?: any
  ): Promise<Member> {
    return this.getLevel(levelRef).then(level =>
      this.datasource
        .fetchMember(level, key, options)
        .then(member => new Member(member, level))
    );
  }

  getMembers(
    levelRef: Level | LevelDescriptor,
    options?: any
  ): Promise<Member[]> {
    return this.getLevel(levelRef).then(level =>
      this.datasource
        .fetchMembers(level, options)
        .then(members => members.map(member => new Member(member, level)))
    );
  }

  parseQueryURL(
    url: string,
    options: Partial<ParseURLOptions> = {}
  ): Promise<Query> {
    const {serverUrl} = this.datasource;
    if (!url.startsWith(serverUrl)) {
      throw new ClientError(
        `Provided URL doesn't belong to the datasource set on this client instance: ${serverUrl}`
      );
    }
    const cubeMatch = /\/cubes\/([^\/]+)\/|\bcube=([^&]+)&/.exec(url);
    if (!cubeMatch) {
      throw new ClientError(`Provided URL is not a valid Query URL: ${url}`);
    }
    const cubeName = cubeMatch[1] || cubeMatch[2];
    return this.getCube(cubeName).then(cube => {
      return this.datasource.parseQueryURL(cube.query, url, options);
    });
  }

  setDataSource(datasource: IDataSource): void {
    if (datasource !== this._ds) {
      this._ds = datasource;
      this._cubeCache = {};
      this._cubesCache = undefined;
    }
  }

  setRequestConfig(config: AxiosRequestConfig): void {
    this.datasource.setRequestConfig(config);
  }
}
