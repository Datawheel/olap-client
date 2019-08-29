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

// The constructor parameter is optional
// You can also set/reset the datasource afterwards
const otherDatasource = new TesseractDataSource("https://another.tesseract-olap.server/olap/");
client.setDataSource(otherDatasource);

// If you don't know beforehand, use the Client.fromURL(url) static method
// It will do some requests to try and guess the type of datasource

// .then chaining
let unknownClient;
Client.fromURL("https://unknown.server/olap/").then(client => {
  unknownClient = client;
});
// async/await
const unknownClient = await Client.fromURL("https://unknown.server/olap/");

// If you really need the client object directly, you can initialize the instance and
// add the DataSource later
const client = new Client();
Client.dataSourceFromURL("https://unknown.server/olap/").then(datasource => {
  client.setDataSource(datasource);
});
// Notice if a method of an `IClient` instance without a configured DataSource is called,
// it will return a Promise rejected with a ClientError.
```

## MultiClient initialization

```js
import {MultiClient, TesseractDataSource} from "@datawheel/olap-client"

// MultiClient instances can also be initialized with or without a datasource
const client = new MultiClient();

// To add a datasource, use the #addDataSource() method instead of #setDataSource()
const datasource = new TesseractDataSource("https://your.mondrian-rest.server/");
client.addDataSource(datasource);

// You can pass multiple datasources to the #addDataSource() method
client.addDataSource(datasourceA, datasourceB, datasourceC);

// Likewise to Client, if you don't know beforehand, you can let the client guess
const unknownClient = MultiClient.fromURL("https://unknown.server/olap/", "https://another.server/", ...);
```

## Usage

Both `Client` and `MultiClient` instances follow the `IClient` interface. `Client` and `MultiClient`-specific methods are at the end.

### interface `IClient`

#### `IClient#getCubes()`

Returns a promise that resolves to a `Cube` array.  
In a `MultiClient` instance, the cubes from all the subscribed datasources are concatenated.

#### `IClient#getCube(cubeName: string, selectorFn?: (cubes: Cube[]) => Cube)`

Returns a promise that resolves to a single `Cube` instance, whose `.name` is equal to the `cubeName` parameter.  
In a `MultiClient` instance, if there's more than one cube with the same `cubeName`, a `selectorFn` function can be used to pick the right cube.

#### `IClient#getMembers(levelDescriptor, options)`

Returns a promise that resolves to a list of the members available for the level referenced. `levelDescriptor` can be a `Level` instance, or an object that tries to describe how to find a `Level` in a DataSource. For more information on this object, check [Interfaces > LevelDescriptor](#LevelDescriptor).

#### `IClient#getMember(levelDescriptor, key, options)`

#### `IClient#execQuery(query)`

Execute a query in all the available datasources.  
The `query` parameter must be a `Query` instance, usually obtained from a `Cube` instance.

### class `Client`

#### `Client#checkStatus()`

Returns an object with information about the server. For now, only supports detailed info about Tesseract OLAP, but tries its best with Mondrian REST anyway.

#### `Client#setDataSource(datasource: DataSource)`

Sets the datasource the client instance will work with.
The `datasource` parameter must be an object compatible with the `IDataSource` interface.

#### `Client.dataSourceFromURL(serverUrl: string)`

Tries to guess the type of server from a request to the `serverUrl`. The parameter must be a string.  
Since a request must be done beforehand, this static method returns a `Promise` that resolves to a object compatible with the `IDataSource` interface.

#### `Client.fromURL(serverUrl: string)`

Using the result from `Client.dataSourceFromURL(serverUrl)`, generates a `new Client(datasource)` instance.

### class `MultiClient`

#### `MultiClient#addDataSource(...datasources: DataSource[])`

Adds datasources to the client internal directory. 
The `datasources` must be objects compatible with the `IDataSource` interface.

#### `MultiClient#checkStatus()`

Returns an array of objects with information about each datasource server. Returns the same structure of response as `Client#checkStatus`.

#### `MultiClient.dataSourcesFromURL(...serverUrls: string[])`

Does a request to each `serverUrl`, tries to guess the type of server and generates a datasource, and each datasource is added to a single `MultiClient` instance.  
This method returns a `Promise` that resolves to a `MultiClient` instance.

#### `MultiClient.fromURL(...serverUrls: string[])`

From the result from `MultiClient.dataSourcesFromURL(...serverUrls)`, generates a `new MultiClient(...datasources)` instance.

## Other interfaces

### LevelDescriptor

A LevelDescriptor is an ordinary object with enough info to differentiate a Level in a list of DataSources. Depending on the circumstances (e.g. some name is shared in more than one object) some Level might need more information on a LevelDescriptor to find the correct object.

A LevelDescriptor has the following structure:
- `LevelDescriptor.level` (string, required) = Level name
- `LevelDescriptor.hierarchy`: (string) = Parent hierarchy name
- `LevelDescriptor.dimension`: (string) = Parent dimension name
- `LevelDescriptor.cube`: (string) = Parent cube name
- `LevelDescriptor.server`: (string) = Parent data source server url

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
