import {
  Aggregation as TesseractAggregation,
  Client as TesseractClient,
  Cube as TesseractCube,
  Format as TesseractFormat,
  Level as TesseractLevel,
  Member as TesseractMember,
  Query as TesseractQuery,
  ServerStatus as TesseractServerStatus
} from "@datawheel/tesseract-client";
import {AxiosError} from "axios";
import {
  Aggregation as MondrianAggregation,
  Client as MondrianClient,
  Cube as MondrianCube,
  Format as MondrianFormat,
  Level as MondrianLevel,
  Member as MondrianMember,
  Query as MondrianQuery,
  ServerStatus as MondrianServerStatus
} from "mondrian-rest-client";
import {ClientError} from "./errors";

export enum ServerSoftware {
  Mondrian = "mondrian",
  Tesseract = "tesseract"
}

interface ServerStatus extends TesseractServerStatus, MondrianServerStatus {}

type Client = TesseractClient | MondrianClient;
type Aggregation = TesseractAggregation | MondrianAggregation;
type Cube = TesseractCube | MondrianCube;
type Member = TesseractMember | MondrianMember;

export class MultiClient {
  private clients: {[server: string]: Client} = {};

  get clientList(): Client[] {
    const clients = this.clients;
    return Object.keys(clients).map(url => clients[url]);
  }

  addServer(serverUrl: string, server?: string): Promise<ServerStatus> {
    const {clients} = this;
    let client: Client;
    const saveClient = (server: ServerStatus) => {
      clients[serverUrl] = client;
      return server;
    };

    if (serverUrl in clients) {
      return clients[serverUrl].checkStatus();
    }
    if (server === "tesseract") {
      client = new TesseractClient(serverUrl);
      return client.checkStatus().then(saveClient);
    }
    else if (server === "mondrian") {
      client = new MondrianClient(serverUrl);
      return client.checkStatus().then(saveClient);
    }
    else {
      client = new TesseractClient(serverUrl);
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
  }

  removeServer(serverUrl: string): void {
    delete this.clients[serverUrl];
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
    format?: TesseractFormat,
    method?: string
  ): Promise<TesseractAggregation>;
  execQuery(
    query: MondrianQuery,
    format?: MondrianFormat,
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

  private getClientByCube(cube: TesseractCube): TesseractClient;
  private getClientByCube(cube: MondrianCube): MondrianClient;
  private getClientByCube(cube: any): Client {
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
