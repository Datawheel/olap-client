import { AxiosRequestConfig } from "axios";
import { CacheManager } from "./cache";
import { Cube } from "./cube";
import { Aggregation, IClient, IDataSource, ServerStatus } from "./interfaces/contracts";
import { PlainCube, PlainMember } from "./interfaces/plain";
import { Level, LevelReference } from "./level";
import { Member } from "./member";
import { Query } from "./query";
import { getLevel, inferDataSource, matchCubeNameFromURL, ParseURLOptions, ServerConfig } from "./toolbox/client";

export class Client implements IClient {
  private _cache: CacheManager<Cube> = new CacheManager(cube => cube.name);
  private _ds: IDataSource | undefined;

  static dataSourceFromURL(config: ServerConfig): Promise<IDataSource> {
    return inferDataSource(config);
  }

  static fromURL(config: ServerConfig): Promise<Client> {
    return inferDataSource(config).then(
      (datasource: IDataSource) => new Client(datasource)
    );
  }

  constructor(datasource?: IDataSource) {
    datasource && this.setDataSource(datasource);
  }

  checkStatus(): Promise<ServerStatus> {
    return this.datasource.checkStatus();
  }

  get datasource(): IDataSource {
    if (this._ds) {
      return this._ds;
    }
    throw new Error(`This Client instance has no DataSource configured.
Verify the initialization procedure, there might be a race condition.`);
  }

  execQuery(query: Query, endpoint?: string): Promise<Aggregation> {
    return this.datasource.execQuery(query, endpoint);
  }

  getCube(cubeName: string): Promise<Cube> {
    const datasource = this.datasource;
    return this._cache.getItem(cubeName, () =>
      datasource
        .fetchCube(cubeName)
        .then((cube: PlainCube) => new Cube(cube, datasource))
    );
  }

  getCubes(): Promise<Cube[]> {
    const datasource = this.datasource;
    return this._cache.getAllItems(() =>
      datasource
        .fetchCubes()
        .then((cubes: PlainCube[]) =>
          cubes.map((cube: PlainCube) => new Cube(cube, datasource))
        )
    );
  }

  getMember(
    levelRef: LevelReference,
    key: string | number,
    options?: any
  ): Promise<Member> {
    return getLevel(this, levelRef).then((level: Level) =>
      this.datasource
        .fetchMember(level, key, options)
        .then((member: PlainMember) => new Member(member, level))
    );
  }

  getMembers(levelRef: LevelReference, options?: any): Promise<Member[]> {
    return getLevel(this, levelRef).then((level: Level) =>
      this.datasource
        .fetchMembers(level, options)
        .then((members: PlainMember[]) =>
          members.map((member: PlainMember) => new Member(member, level))
        )
    );
  }

  parseQueryURL(
    url: string,
    options: Partial<ParseURLOptions> = {}
  ): Promise<Query> {
    const { serverUrl } = this.datasource;
    if (!options.anyServer && url.indexOf(serverUrl) === -1) {
      const reason = `Provided URL doesn't belong to the datasource set on this client instance:
DataSource server: ${serverUrl}
Provided server: ${url.slice(0, url.indexOf("/", 10))}
`;
      return Promise.reject(new Error(reason));
    }
    return Promise.resolve(url)
      .then(matchCubeNameFromURL)
      .then((cubeName: string) => this.getCube(cubeName))
      .then((cube: Cube) =>
        this.datasource.parseQueryURL(cube.query, url, options)
      );
  }

  setDataSource(datasource: IDataSource): void {
    if (datasource !== this._ds) {
      this._ds = datasource;
      this._cache = new CacheManager(cube => cube.name);
    }
  }

  setRequestConfig(config: AxiosRequestConfig): void {
    this.datasource.setRequestConfig(config);
  }
}
