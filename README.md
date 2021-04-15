# @datawheel/olap-client

Javascript client to interact with mondrian-rest and tesseract-olap servers.  
This package is the sucessor of the `mondrian-rest-client` and the `@datawheel/tesseract-client` packages.

[![NPM](https://img.shields.io/npm/v/@datawheel/olap-client.svg)](https://www.npmjs.com/package/@datawheel/olap-client)

## Installation

```bash
npm install @datawheel/olap-client
```

## Client initialization

```js
import {Client, MondrianDataSource, TesseractDataSource} from "@datawheel/olap-client"

// Create an instance of the DataSource according to the type of server
const datasource = new MondrianDataSource("https://your.mondrian-rest.server/");

// ...and pass it as the parameter to initialize your client
const client = new Client(datasource);
```

The constructor parameter is optional. You can also set/reset the datasource afterwards:

```js
const client = new Client();

// ...

const datasource = new TesseractDataSource("https://another.tesseract-olap.server/olap/");
client.setDataSource(datasource);
```

If you don't know beforehand, use the `Client.fromURL(url)` static method.
It will do some requests to try and guess the type of datasource.

```js
// Using Promise chaining
let unknownClient;
Client.fromURL("https://unknown.server/olap/").then(client => {
  unknownClient = client;
});

// Using async/await
const unknownClient = await Client.fromURL("https://unknown.server/olap/");
```

If you really need the client object directly, you can initialize the instance and add the DataSource later:

```js
const client = new Client();

// ...

Client.dataSourceFromURL("https://unknown.server/olap/").then(datasource => {
  client.setDataSource(datasource);
});
```

Notice if you try to interact with a method of an `IClient` instance without a configured DataSource, it will throw an error.

Both `Client.fromURL` and `Client.dataSourceFromURL` also accept an [AxiosRequestConfig](https://github.com/axios/axios#request-config) object, so you can customize the headers and other properties of the testing request.
These additional properties will be stored in the DataSource instance, and will be reused in future requests through the client. You can change them at any time using the `IClient#setRequestConfig` method.

## MultiClient initialization

```js
import {MultiClient, TesseractDataSource} from "@datawheel/olap-client"

// MultiClient instances can also be initialized with or without a datasource
const client = new MultiClient();

// To add a datasource, use the #addDataSource() method instead of #setDataSource()
const datasource = new TesseractDataSource("https://your.mondrian-rest.server/");
client.addDataSource(datasource);
```

You can pass multiple datasources to the `MultiClient#addDataSource()` method:

```js
client.addDataSource(datasourceA, datasourceB, datasourceC);
```

And likewise Client, if you don't know beforehand, you can let the client guess the type of datasource:

```js
const unknownClient = MultiClient.fromURL("https://unknown.server/olap/", "https://another.server/", ...);
```

## Usage

Both `Client` and `MultiClient` instances follow the `IClient` interface. `Client` and `MultiClient`-specific methods are described at the end.

### interface `IClient`

#### `IClient#getCubes`

```ts
getCubes(): Promise<Cube[]>
```

Returns a promise that resolves to a `Cube` array.  
In a `MultiClient` instance, the cubes from all the subscribed datasources are concatenated.

#### `IClient#getCube`

```ts
getCube(cubeName: string, selectorFn?: (cubes: Cube[]) => Cube): Promise<Cube>
```

Returns a promise that resolves to a single `Cube` instance, whose `.name` is equal to the `cubeName` parameter.  
In a `MultiClient` instance, if there's more than one cube with the same `cubeName`, a `selectorFn` function can be used to pick the right cube.

#### `IClient#getMembers`

```ts
getMembers(levelRef: Level | LevelDescriptor, options?: any): Promise<Member[]>
```

Returns a promise that resolves to a list of the members available for the level referenced.  
`levelRef` can be a `Level` instance, or an object describing how to find a `Level` in a DataSource. For more information on this object, see the specification of the [LevelDescriptor interface](#interface-leveldescriptor).  
the properties `options` 

#### `IClient#getMember`

```ts
getMember(levelRef: Level | LevelDescriptor, key: string | number, options?: any): Promise<Member>
```

Returns a promise that resolves to a member for the level referenced, specified by its `key`.

#### `IClient#execQuery`

```ts
execQuery(query: Query, endpoint?: string): Promise<Aggregation>
```

Execute a query in all the available datasources. The returned object implements the [Aggregation interface](#interface-aggregation).  
The `query` parameter must be a `Query` instance, usually obtained from a `Cube` instance.

#### `IClient#parseQueryURL`

```ts
parseQueryURL(url: string, options?: Partial<ParseURLOptions>): Promise<Query>;
```

Allows to parse a query URL for the server (or one of them) associated to the `IClient` instance, and get a `Query` instance with its associated data.
Since the `IClient` instance needs a `Cube` to populate the `Query`, this method returns a Promise that fullfills to a `Query`.
All invalid parameters for the current state of the Cube are ignored.  
Additionally, the [`options` parameter](#interface-parseurloptions) allows the user to `include`/`exclude`/`filter` certain parameters from the resulting query.

#### `IClient#setRequestConfig`

```ts
setRequestConfig(config: AxiosRequestConfig): void;
```

Sets the [default configuration parameters](https://github.com/axios/axios#request-config) for the requests done on all the associated DataSources.
This method is also available on the `IDataSource` interface, so configurations can be different on each datasource, on the same client.

### class `Client`

#### `Client#checkStatus`

```ts
checkStatus(): Promise<ServerStatus>
```

Returns an [object with information](#interface-serverstatus) about the server. For now, only supports detailed info about Tesseract OLAP, but tries its best with Mondrian REST anyway.

#### `Client#setDataSource`

```ts
setDataSource(datasource: IDataSource): void
```

Sets the datasource the client instance will work with.
The `datasource` parameter must be an object compatible with the `IDataSource` interface.

#### `Client.dataSourceFromURL`

```ts
static dataSourceFromURL(url: string | AxiosRequestConfig): Promise<IDataSource>
```

Tries to guess the type of server from a request to the `serverUrl`. The parameter must be a string.  
Since a request must be done beforehand, this static method returns a `Promise` that resolves to a object compatible with the `IDataSource` interface.

#### `Client.fromURL`

```ts
static fromURL(url: string | AxiosRequestConfig): Promise<Client>
```

Using the result from `Client.dataSourceFromURL(serverUrl)`, generates a `new Client(datasource)` instance.

### class `MultiClient`

#### `MultiClient#addDataSource`

```ts
addDataSource(...datasources: IDataSource[]): void
```

Adds datasources to the client internal directory. 
The `datasources` must be objects compatible with the `IDataSource` interface.

#### `MultiClient#checkStatus`

```ts
checkStatus(): Promise<ServerStatus[]>
```

Returns an array of [objects with information](#interface-serverstatus) about each datasource server. These objects have the same structure of response as `Client#checkStatus`.

#### `MultiClient.dataSourcesFromURL`

```ts
static dataSourcesFromURL(...serverUrls: Array<string | AxiosRequestConfig>): Promise<IDataSource[]>
```

Does a request to each url in `serverUrls`, tries to guess the type of server, and returns the respective datasource.  
This method returns a `Promise` that resolves to an array of `IDataSource`.

#### `MultiClient.fromURL`

```ts
static fromURL(...serverUrls: Array<string | AxiosRequestConfig>): Promise<MultiClient>
```

From the result from `MultiClient.dataSourcesFromURL(...serverUrls)`, generates a single `new MultiClient(...datasources)` instance.  
This method returns a `Promise` that resolves to a `MultiClient` instance.

## Other interfaces

### interface `Aggregation`

```ts
interface Aggregation<T = any> {
  data: T;
  headers: Record<string, string>; // Response headers
  query: Query;
  status?: number;
  url?: string;
}
```

The result of executing a Query is represented by an object implementing the `Aggregation` interface.
The type of the `data` property depends on the `format` set on the Query: 
- `Format.jsonrecords` returns an array of tidy data objects
- All other `Format`s return the raw data returned by the server

### interface `LevelDescriptor`

```ts
interface LevelDescriptor {
  server?: string; // Server URL
  cube?: string; // Cube name
  dimension?: string; // Dimension name
  hierarchy?: string; // Hierarchy name
  level: string; // Level name, required
}
```

A LevelDescriptor is an ordinary object with enough info to differentiate a Level in a list of DataSources. Depending on the circumstances (e.g. some name is shared in more than one object) some Levels might need more information on a LevelDescriptor to be differentiated. All the properties are the `name`s of the parents, except for `server` that maps to the URL of the DataSource. Level is the only required at all times.
It is suggested to fill the properties with as much information as possible to prevent getting a different level.

### interface `ParseURLOptions`

```ts
interface ParseURLOptions {
  anyServer: boolean;
  exclude: string[];
  include: string[];
  filter: (key: string, value: string | boolean | string[]) => boolean;
}
```

Gives the directions for the parseQueryURL method to `include` explicitly only some properties, or `exclude` properties from the ones available, or to `filter` on a parameter by parameter basis.  
Setting the `anyServer` property to `true` bypasses the check for the URL to the server associated to the query object, so only the query params are used to populate query properties. The `include` and `exclude` directives supersede the `filter` function.

### interface `ServerStatus`

```ts
interface ServerStatus {
  software: string;
  online: boolean;
  url: string;
  version: string;
}
```

Contains information about the current state of the server.  
Due to server implementation, `version` isn't available from `MondrianDataSource`.

### interface `IDataSource`

This package integrates the `TesseractDataSource` and `MondrianDataSource` classes, but the clients can work with any object that implements the `IDataSource` interface correctly:

```ts
interface IDataSource {
  serverOnline: boolean;
  serverSoftware: string;
  serverUrl: string;
  serverVersion: string;
  checkStatus(): Promise<ServerStatus>;
  execQuery(query: Query, endpoint?: string): Promise<Aggregation>;
  fetchCube(cubeName: string): Promise<PlainCube>;
  fetchCubes(): Promise<PlainCube[]>;
  fetchMember(parent: Level, key: string | number, options?: any): Promise<PlainMember>;
  fetchMembers(parent: Level, options?: any): Promise<PlainMember[]>;
  parseQueryURL(query: Query, url: string, options: Partial<ParseURLOptions>): Query;
  setRequestConfig(config: AxiosRequestConfig): void;
  stringifyQueryURL(query: Query, kind: string): string;
}
```

Check the [source code](src/interfaces/plain.ts) to see the requirements of the `PlainObject` interfaces and how the current data sources are implemented.

## Example

```js
Client.fromURL("https://chilecube.datachile.io")
  .then(client => {
    return client.getCube("tax_data").then(cube => {
      const query = cube.query;
      query
        .addMeasure("Labour")
        .addDrilldown("Year")
        .setOption("debug", false)
        .setOption("distinct", false)
        .setOption("nonempty", true);
      return client.execQuery(query);
    });
  })
  .then(aggregation => {
    console.log(aggregation);
  });
```

## License

MIT © 2019 [Datawheel](https://datawheel.us/)
