import type {AxiosRequestConfig} from "axios";
import {CacheManager} from "./cache";
import {Cube} from "./cube";
import type {
  Aggregation,
  IClient,
  IDataSource,
  ServerStatus,
} from "./interfaces/contracts";
import type {LevelDescriptor} from "./interfaces/descriptors";
import type {PlainCube, PlainMember} from "./interfaces/plain";
import type {Level} from "./level";
import {Member} from "./member";
import type {Query} from "./query";
import {
  type ParseURLOptions,
  type ServerConfig,
  getLevel,
  inferDataSource,
  matchCubeNameFromURL,
} from "./toolbox/client";

export class MultiClient implements IClient {
  private _cache: Record<string, CacheManager<Cube>> = {};
  private datasources: Record<string, IDataSource | undefined> = {};

  static dataSourcesFromURL(...configs: ServerConfig[]): Promise<IDataSource[]> {
    const promises = configs.map(inferDataSource);
    return Promise.all(promises);
  }

  static fromURL(...configs: ServerConfig[]): Promise<MultiClient> {
    const promises = configs.map(inferDataSource);
    return Promise.all(promises).then(
      (datasources: IDataSource[]) => new MultiClient(...datasources),
    );
  }

  constructor(...datasources: IDataSource[]) {
    this.addDataSource(...datasources);
  }

  addDataSource(...datasources: IDataSource[]) {
    let n = datasources.length;
    while (n--) {
      const datasource = datasources[n];
      const key = datasource.serverUrl;
      if (!this.datasources[key]) {
        this.datasources[key] = datasource;
        this._cache[key] = new CacheManager((cube) => cube.name);
      }
    }
  }

  checkStatus(): Promise<ServerStatus[]> {
    const promises = this.dataSourceList.map((datasource: IDataSource) =>
      datasource.checkStatus(),
    );
    return Promise.all(promises);
  }

  get dataSourceList(): IDataSource[] {
    const datasources = Object.values(this.datasources).filter(Boolean) as IDataSource[];
    if (datasources.length > 0) {
      return datasources;
    }
    throw new Error(
      "This Client instance has no DataSource configured. Verify the initialization procedure, there might be a race condition.",
    );
  }

  execQuery(query: Query, endpoint?: string): Promise<Aggregation> {
    const datasource = this.datasources[query.cube.server];
    if (datasource) {
      return datasource.execQuery(query, endpoint);
    }
    const err = new Error("No DataSource matched the parent Cube of your Query object.");
    return Promise.reject(err);
  }

  getCube(cubeName: string, selectorFn?: (cubes: Cube[]) => Cube): Promise<Cube> {
    const maybeCubesPromise = this.dataSourceList.map((datasource: IDataSource) => {
      const cache = this._cache[datasource.serverUrl];
      return cache
        .getItem(cubeName, () =>
          datasource
            .fetchCube(cubeName)
            .then((cube: PlainCube) => new Cube(cube, datasource)),
        )
        .catch(() => undefined);
    });

    const cubesPromise = Promise.all(maybeCubesPromise).then(
      (values: (Cube | undefined)[]) => values.filter(Boolean) as Cube[],
    );

    return cubesPromise.then((cubes: Cube[]) => {
      if (cubes.length === 1) {
        return cubes[0];
      }
      if (selectorFn) {
        return selectorFn(cubes);
      }
      const reason = `There's a cube named ${cubeName} in more than one datasource.
To prevent this error, pass a selectorFn parameter to the MultiClient#getCube method.`;
      throw new Error(reason);
    });
  }

  getCubes(): Promise<Cube[]> {
    const cubesPromise = this.dataSourceList.map((datasource: IDataSource) => {
      const cache = this._cache[datasource.serverUrl];
      return cache.getAllItems(() =>
        datasource
          .fetchCubes()
          .then((cubes: PlainCube[]) =>
            cubes.map((cube: PlainCube) => new Cube(cube, datasource)),
          ),
      );
    });
    return Promise.all(cubesPromise).then((cubes) => ([] as Cube[]).concat(...cubes));
  }

  getMember(
    levelRef: Level | LevelDescriptor,
    key: string | number,
    options?: any,
  ): Promise<Member> {
    return getLevel(this, levelRef).then((level: Level) => {
      const server = level.cube.server;
      const datasource = this.datasources[server];
      if (!datasource) {
        const reason = `No DataSource matched the parent Cube of matching Level:
LevelDescriptor: ${JSON.stringify(levelRef)}
Level: ${level}`;
        return Promise.reject(new Error(reason));
      }
      return datasource
        .fetchMember(level, key, options)
        .then((member: PlainMember) => new Member(member, level));
    });
  }

  getMembers(levelRef: Level | LevelDescriptor, options?: any): Promise<Member[]> {
    return getLevel(this, levelRef).then((level: Level) => {
      const server = level.cube.server;
      const datasource = this.datasources[server];
      if (!datasource) {
        const reason = `No DataSource matched the parent Cube of matching Level:
LevelDescriptor: ${JSON.stringify(levelRef)}
Level: ${level}`;
        return Promise.reject(new Error(reason));
      }
      return datasource
        .fetchMembers(level, options)
        .then((members: PlainMember[]) =>
          members.map((member: PlainMember) => new Member(member, level)),
        );
    });
  }

  parseQueryURL(url: string, options: Partial<ParseURLOptions> = {}): Promise<Query> {
    const datasource = this.dataSourceList.find(
      (datasource: IDataSource) => url.indexOf(datasource.serverUrl) > -1,
    );
    if (!datasource) {
      const reason = new Error(
        `Provided URL not available on this MultiClient instance: ${url}`,
      );
      return Promise.reject(reason);
    }
    const cubePicker = (cubes: Cube[]) =>
      cubes.find((cube: Cube) => cube.server === datasource.serverUrl) || cubes[0];
    return Promise.resolve(url)
      .then(matchCubeNameFromURL)
      .then((cubeName: string) => this.getCube(cubeName, cubePicker))
      .then((cube: Cube) => datasource.parseQueryURL(cube.query, url, options));
  }

  setRequestConfig(config: AxiosRequestConfig): void {
    const list = this.dataSourceList;
    for (let i = 0; i < list.length; i++) {
      list[i].setRequestConfig(config);
    }
  }
}
