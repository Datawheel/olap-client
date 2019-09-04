import Axios, {AxiosError, AxiosResponse} from "axios";
import Cube from "./cube";
import {ClientError, ServerError} from "./errors";
import {
  AdaptedCube,
  Aggregation,
  IClient,
  IDataSource,
  LevelDescriptor,
  ServerStatus
} from "./interfaces";
import Level from "./level";
import Member from "./member";
import {MondrianDataSource} from "./mondrian/datasource";
import {Query} from "./query";
import {TesseractDataSource} from "./tesseract/datasource";
import {arrayMapper, levelFinderFactory} from "./utils";

class MultiClient implements IClient {
  private cubeCache: {[key: string]: Promise<Cube[]>} = {};
  private cubesCache: Promise<Cube[]> | undefined = undefined;
  private datasources: {[url: string]: IDataSource | undefined} = {};

  static dataSourcesFromURL(...urls: string[]): Promise<IDataSource[]> {
    const promises = urls.map(url =>
      Axios.get(url).then(
        (response: AxiosResponse) => {
          if (response.status === 200 && "tesseract_version" in response.data) {
            return new TesseractDataSource(url);
          }
          throw new ServerError(response, `URL is not a known OLAP server: ${url}`);
        },
        (error: AxiosError) => {
          if (error.response && error.response.status === 404) {
            return new MondrianDataSource(url);
          }
          throw error;
        }
      )
    );
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

  get dataSourceList(): IDataSource[] {
    const datasources = Object.values(this.datasources).filter(Boolean) as IDataSource[];
    if (datasources.length === 0) {
      throw new ClientError(`This Client instance has no DataSource configured.
Verify the initialization procedure, there might be a race condition.`);
    }
    return datasources;
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
      this.cubeCache = {};
      this.cubesCache = undefined;
    }
  }

  private cacheCube(cubes: Cube[]): void {
    const cubeMap = arrayMapper(cubes, "name");
    Object.keys(cubeMap).forEach(cubeName => {
      this.cubeCache[cubeName] = Promise.resolve(cubeMap[cubeName]);
    });
  }

  checkStatus(): Promise<ServerStatus[]> {
    const promises = this.dataSourceList.map(datasource => datasource.checkStatus());
    return Promise.all(promises);
  }

  execQuery(query: Query, endpoint?: string): Promise<Aggregation> {
    const datasource = this.datasources[query.cube.server];
    if (!datasource) {
      const error = new ClientError(
        `No DataSource matched the parent Cube of your Query object.`
      );
      return Promise.reject(error);
    }
    return datasource.execQuery(query, endpoint);
  }

  getCube(cubeName: string, selectorFn?: (cubes: Cube[]) => Cube): Promise<Cube> {
    const promise =
      this.cubeCache[cubeName] ||
      Promise.resolve(this.dataSourceList).then(datasources => {
        const promises = datasources.map(datasource =>
          datasource
            .fetchCube(cubeName)
            .then((acube: AdaptedCube) => new Cube(acube, datasource), () => undefined)
        );
        return Promise.all(promises).then(values => {
          const cubes = values.filter(Boolean) as Cube[];
          this.cacheCube(cubes);
          return cubes;
        });
      });

    this.cubeCache[cubeName] = promise;

    return promise.then((cubes: Cube[]) => {
      if (cubes.length === 1) {
        return cubes[0];
      }
      if (selectorFn) {
        return selectorFn(cubes);
      }
      throw new ClientError(
        `There's a cube named ${cubeName} in more than one datasource.
To prevent this error, pass a selectorFn parameter to the MultiClient#getCube method.`
      );
    });
  }

  getCubes(): Promise<Cube[]> {
    const promise =
      this.cubesCache ||
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
    this.cubesCache = promise;
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
    return this.getLevel(levelRef).then(level => {
      const server = level.cube.server;
      const datasource = this.datasources[server];
      if (!datasource) {
        throw new ClientError(
          `No DataSource matched the parent Cube of matching Level:
LevelDescriptor: ${JSON.stringify(levelRef)}
Level: ${level}`
        );
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
        throw new ClientError(
          `No DataSource matched the parent Cube of matching Level:
LevelDescriptor: ${JSON.stringify(levelRef)}
Level: ${level}`
        );
      }
      return datasource
        .fetchMembers(level, options)
        .then(members => members.map(member => new Member(member, level)));
    });
  }
}

export default MultiClient;
