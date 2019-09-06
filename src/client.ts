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
import {levelFinderFactory} from "./utils";

export class Client implements IClient {
  private _cubeCache: {[key: string]: Promise<Cube>} = {};
  private _cubesCache: Promise<Cube[]> | undefined = undefined;
  private _ds: IDataSource | undefined;

  static dataSourceFromURL(url: string): Promise<IDataSource> {
    return Axios.get(url).then(
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
    );
  }

  static fromURL(url: string): Promise<Client> {
    return Client.dataSourceFromURL(url).then(datasource => new Client(datasource));
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
      this.datasource.fetchMember(level, key, options).then(member => new Member(member, level))
        );
      }

  getMembers(levelRef: Level | LevelDescriptor, options?: any): Promise<Member[]> {
    return this.getLevel(levelRef).then(level =>
      this.datasource
        .fetchMembers(level, options)
        .then(members => members.map(member => new Member(member, level)))
        );
      }

  setDataSource(datasource: IDataSource): void {
    if (datasource !== this._ds) {
      this._ds = datasource;
      this._cubeCache = {};
      this._cubesCache = undefined;
    }
  }
}
