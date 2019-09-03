import Cube from "./cube";
import {ClientError} from "./errors";
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
import {Query} from "./query";
import {levelFinderFactory} from "./utils";

class MultiClient implements IClient {
  private cubeCache: {[key: string]: Promise<Cube[]>} = {};
  private cubesCache: Promise<Cube[]> | undefined = undefined;
  private datasources: {[url: string]: IDataSource | undefined};

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
    if (datasources.length > 0) {
      for (let datasource of datasources) {
        this.datasources[datasource.serverUrl] = datasource;
      }
      this.cubeCache = {};
      this.cubesCache = undefined;
    }
  }

  private cacheCube(cube: Cube): Promise<Cube> {
    const promise = this.cubeCache[cube.name] || Promise.resolve([]);
    return promise.then(cubes => {
      const cubeUri = cube.toString();
      const finalCubes = cubes.some(c => c.toString() === cubeUri)
        ? cubes
        : cubes.concat(cube);
      this.cubeCache[cube.name] = Promise.resolve(finalCubes);
      return cube;
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
          datasource.fetchCube(cubeName).then((acube: AdaptedCube) => {
            const cube = new Cube(acube, datasource);
            return this.cacheCube(cube);
          }, () => undefined)
        );
        return Promise.all(promises).then(values => values.filter(Boolean) as Cube[]);
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
            const promises = acubes.map(acube => {
              const cube = new Cube(acube, datasource);
              return this.cacheCube(cube);
            });
            return Promise.all(promises);
          })
        );
        return Promise.all(promises).then(cubesList =>
          ([] as Cube[]).concat(...cubesList)
        );
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
        .fetchMember(level.descriptor, key, options)
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
        .fetchMembers(level.descriptor, options)
        .then(members => members.map(member => new Member(member, level)));
    });
  }
}

export default MultiClient;
