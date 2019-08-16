import {
  Aggregation as TesseractAggregation,
  Client as TesseractClient,
  Cube as TesseractCube,
  Format as TesseractFormat,
  Level as TesseractLevel,
  Member as TesseractMember,
  Query as TesseractQuery
} from "@datawheel/tesseract-client";
import {AxiosError} from "axios";
import {
  Aggregation as MondrianAggregation,
  Client as MondrianClient,
  Cube as MondrianCube,
  Format as MondrianFormat,
  Level as MondrianLevel,
  Member as MondrianMember,
  Query as MondrianQuery
} from "mondrian-rest-client";
import {Aggregation, Client, Cube, Member} from "./common";
import {ClientError} from "./errors";

interface ServerStatus {
  software: string;
  status: string;
  url: string;
  version: string;
}

class MultiClient {
  private clients: {[server: string]: Client} = {};

  get clientList(): Client[] {
    const clients = this.clients;
    return Object.keys(clients).map(url => clients[url]);
  }

  addServer(serverUrl: string): Promise<ServerStatus> {
    const {clients} = this;
    let client : Client = new TesseractClient(serverUrl);
    const saveClient = (server: ServerStatus) => {
      clients[serverUrl] = client;
      return server;
    };
    return client.checkStatus().then(saveClient, (error: AxiosError) => {
      // "response" in error means the url is valid
      // but the response wasn't in the 2xx range
      if (!error.response) {
        throw error;
      }
      client = new MondrianClient(serverUrl);
      return client.checkStatus().then(saveClient);
    });
  }

  cube(
    cubeName: string,
    sorterFn: (matches: Cube[], clients: Client[]) => Cube
  ): Promise<Cube> {
    const clients = this.clientList;
    return this.cubes().then(cubes => {
      const matches = cubes.filter(cube => cube.name === cubeName);
      if (!sorterFn && matches.length > 1) {
        throw new ClientError(cubeName);
      }
      return matches.length === 1 ? matches[0] : sorterFn(matches, clients);
    });
  }

  cubes(): Promise<Cube[]> {
    const promiseCubeList = this.clientList.map(client => client.cubes());
    return Promise.all<Cube[]>(promiseCubeList).then((cubeList: Cube[][]) =>
      ([] as Cube[]).concat(...cubeList)
    );
  }

  execQuery(
    query: TesseractQuery,
    format?: TesseractFormat.jsonrecords,
    method?: string
  ): Promise<TesseractAggregation>;
  execQuery(
    query: MondrianQuery,
    format?: MondrianFormat.jsonrecords,
    method?: string
  ): Promise<MondrianAggregation>;
  execQuery(query: any, format?: any, method?: any): Promise<Aggregation> {
    const client = this.getClientByCube(query.cube);
    if (!client) {
      throw new ClientError(
        `Query object ${query} is not associated to a cube of the clients.`
      );
    }
    return client.execQuery(query, format, method);
  }

  private getClientByCube(cube: TesseractCube): TesseractClient | undefined;
  private getClientByCube(cube: MondrianCube): MondrianClient | undefined;
  private getClientByCube(cube: any): Client | undefined {
    return this.clients[cube.server];
  }

  members(
    level: TesseractLevel,
    getChildren?: boolean,
    caption?: string
  ): Promise<TesseractMember[]>;
  members(
    level: MondrianLevel,
    getChildren?: boolean,
    caption?: string
  ): Promise<MondrianMember[]>;
  members(level: any, getChildren?: boolean, caption?: string): Promise<Member[]> {
    const client = this.getClientByCube(level.cube);
    if (!client) {
      throw new ClientError(
        `Level object ${level} is not associated to a cube of the clients.`
      );
    }
    return client.members(level, getChildren, caption);
  }
}

export default MultiClient;
