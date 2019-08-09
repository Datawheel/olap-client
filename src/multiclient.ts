import {
  Aggregation as TesseractAggregation,
  Client as TesseractClient,
  Cube as TesseractCube,
  Format as TesseractFormat,
  Level as TesseractLevel,
  Member as TesseractMember,
  Query as TesseractQuery
} from "@datawheel/tesseract-client";
import {
  Aggregation as MondrianAggregation,
  Client as MondrianClient,
  Cube as MondrianCube,
  Format as MondrianFormat,
  Level as MondrianLevel,
  Member as MondrianMember,
  Query as MondrianQuery
} from "mondrian-rest-client";
import {ServerSoftware, Client, Cube, Aggregation, Member} from "./common";
import {ClientError} from "./errors";

interface Metadata {
  server: ServerSoftware;
  status?: string;
  version?: string;
}

class MultiClient {
  private clients: {[server: string]: Client} = {};
  private metadata: {[server: string]: Metadata} = {};

  constructor(urls: string | string[]) {
    ([] as string[]).concat(urls).forEach(this.addServer, this);
  }

  get clientList(): Client[] {
    const clients = this.clients;
    return Object.keys(clients).map(url => clients[url]);
  }

  addServer(serverUrl: string): Promise<void> {
    const {clients, metadata} = this;
    let meta: Metadata;
    let client: Client = new TesseractClient(serverUrl);
    return client
      .checkStatus()
      .then(
        info => {
          meta = {
            version: info.version,
            status: info.status,
            server: ServerSoftware.Tesseract
          };
        },
        error => {
          // "response" in error means the url is valid
          // but the response wasn't in the 2xx range
          if (!error.response) {
            return;
          }
          client = new MondrianClient(serverUrl);
          meta = {
            version: "1.0.0",
            status: undefined,
            server: ServerSoftware.Mondrian
          };
        }
      )
      .then(() => {
        clients[serverUrl] = client;
        metadata[serverUrl] = meta;
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
