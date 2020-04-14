import { AxiosRequestConfig } from "axios";
import urljoin from "url-join";
import { Client } from "./client";
import Cube from "./cube";
import { ClientError } from "./errors";
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
import { Query } from "./query";
import { groupBy, levelFinderFactory } from "./utils";

class MultiClient implements IClient {
  private _cubeCache: Record<string, Promise<Cube[]>> = {};
  private _cubesCache: Promise<Cube[]> | undefined = undefined;
  private datasources: Record<string, IDataSource | undefined> = {};

  static dataSourcesFromURL(...urls: string[]): Promise<IDataSource[]> {
    const promises = urls.map(url => {
      const normalizedUrl = urljoin(url, "/");
      return Client.dataSourceFromURL(normalizedUrl);
    });
    return Promise.all(promises);
  }

  static fromURL(...urls: string[]): Promise<MultiClient> {
    return MultiClient.dataSourcesFromURL(...urls).then(
      datasources => new MultiClient(...datasources)
    );
  }

  constructor(...datasources: IDataSource[]) {
    this.addDataSource(...datasources);
  }

  addDataSource(...datasources: IDataSource[]) {
    let taintedCache = false;

    let n = datasources.length;
    while (n--) {
      const datasource = datasources[n];
      if (!this.datasources[datasource.serverUrl]) {
        this.datasources[datasource.serverUrl] = datasource;
        taintedCache = true;
      }
    }

    if (taintedCache) {
      this._cubeCache = {};
      this._cubesCache = undefined;
    }
  }

  private cacheCube(cubes: Cube[]): void {
    const cubeMap = groupBy(cubes, "name");
    Object.keys(cubeMap).forEach(cubeName => {
      this._cubeCache[cubeName] = Promise.resolve(cubeMap[cubeName]);
    });
  }

  checkStatus(): Promise<ServerStatus[]> {
    const promises = this.dataSourceList.map(datasource => datasource.checkStatus());
    return Promise.all(promises);
  }

  get dataSourceList(): IDataSource[] {
    const datasources = Object.values(this.datasources).filter(Boolean) as IDataSource[];
    if (datasources.length === 0) {
      throw new ClientError(`This Client instance has no DataSource configured.
Verify the initialization procedure, there might be a race condition.`);
    }
    return datasources;
  }

  execQuery(query: Query, endpoint?: string): Promise<Aggregation> {
    const datasource = this.datasources[query.cube.server];
    if (!datasource) {
      const reason = `No DataSource matched the parent Cube of your Query object.`;
      return Promise.reject(new ClientError(reason));
    }
    return datasource.execQuery(query, endpoint);
  }

  getCube(cubeName: string, selectorFn?: (cubes: Cube[]) => Cube): Promise<Cube> {
    const promise =
      this._cubeCache[cubeName] ||
      Promise.resolve(this.dataSourceList).then(datasources => {
        const promises = datasources.map(datasource =>
          datasource.fetchCube(cubeName).then(
            (acube: AdaptedCube) => new Cube(acube, datasource),
            () => undefined
          )
        );
        return Promise.all(promises).then(values => {
          const cubes = values.filter(Boolean) as Cube[];
          this.cacheCube(cubes);
          return cubes;
        });
      });

    this._cubeCache[cubeName] = promise;

    return promise.then((cubes: Cube[]) => {
      if (cubes.length === 1) {
        return cubes[0];
      }
      if (selectorFn) {
        return selectorFn(cubes);
      }
      const reason = `There's a cube named ${cubeName} in more than one datasource.
To prevent this error, pass a selectorFn parameter to the MultiClient#getCube method.`;
      throw new ClientError(reason);
    });
  }

  getCubes(): Promise<Cube[]> {
    const promise =
      this._cubesCache ||
      Promise.resolve(this.dataSourceList).then(datasources => {
        const promises = datasources.map(datasource =>
          datasource.fetchCubes().then((acubes: AdaptedCube[]) => {
            const promises = acubes.map(acube => new Cube(acube, datasource));
            return Promise.all(promises);
          })
        );
        return Promise.all(promises).then(cubesList => {
          const cubes = ([] as Cube[]).concat(...cubesList);
          this.cacheCube(cubes);
          return cubes;
        });
      });
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
          let n = cubes.length;
          while (n--) {
            try {
              return levelFinder(cubes[n]);
            } catch (e) {
              continue;
            }
          }
          const reason = `No level matched the descriptor ${JSON.stringify(identifier)}`;
          throw new ClientError(reason);
        });
  }

  getMember(
    levelRef: Level | LevelDescriptor,
    key: string | number,
    options?: any
  ): Promise<Member> {
    return this.getLevel(levelRef).then(level => {
      const server = level.cube.server;
      const datasource = this.datasources[server];
      if (!datasource) {
        const reason = `No DataSource matched the parent Cube of matching Level:
LevelDescriptor: ${JSON.stringify(levelRef)}
Level: ${level}`;
        return Promise.reject(new ClientError(reason));
      }
      return datasource
        .fetchMember(level, key, options)
        .then(member => new Member(member, level));
    });
  }

  getMembers(levelRef: Level | LevelDescriptor, options?: any): Promise<Member[]> {
    return this.getLevel(levelRef).then(level => {
      const server = level.cube.server;
      const datasource = this.datasources[server];
      if (!datasource) {
        const reason = `No DataSource matched the parent Cube of matching Level:
LevelDescriptor: ${JSON.stringify(levelRef)}
Level: ${level}`;
        return Promise.reject(new ClientError(reason));
      }
      return datasource
        .fetchMembers(level, options)
        .then(members => members.map(member => new Member(member, level)));
    });
  }

  parseQueryURL(url: string, options: Partial<ParseURLOptions> = {}): Promise<Query> {
    const datasource = this.dataSourceList.find(ds => url.startsWith(ds.serverUrl));
    if (!datasource) {
      const reason = `Provided URL not available on this MultiClient instance: ${url}`;
      return Promise.reject(new ClientError(reason));
    }

    const cubeMatch = /\/cubes\/([^\/]+)\/|\bcube=([^&]+)&/.exec(url);
    if (!cubeMatch) {
      const reason = `Provided URL is not a valid Query URL: ${url}`;
      return Promise.reject(new ClientError(reason));
    }
    const cubeName = cubeMatch[1] || cubeMatch[2];
    const cubePicker = (cubes: Cube[]) =>
      cubes.find(cube => cube.server === datasource.serverUrl) || cubes[0];

    return this.getCube(cubeName, cubePicker).then(cube => {
      return datasource.parseQueryURL(cube.query, url, options);
    });
  }

  setRequestConfig(config: AxiosRequestConfig): void {
    this.dataSourceList.forEach(ds => ds.setRequestConfig(config));
  }
}

export default MultiClient;
