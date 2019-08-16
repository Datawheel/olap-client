# @datawheel/olap-client

> Multi-server javascript client, to interact with mondrian-rest and tesseract-olap servers.

[![NPM](https://img.shields.io/npm/v/@datawheel/olap-client.svg)](https://www.npmjs.com/package/@datawheel/olap-client)

## Install

```bash
npm install @datawheel/olap-client
```

## Usage

```js
import {OLAPClient} from '@datawheel/olap-client'

// The instance must be constructed without parameters
const client = new OLAPClient();

// Server URLs are added later using the addServer() method
client.addServer("https://another.tesseract.olap/server/");
```

The client does a request to the server to distinguish if it's a Tesseract server or a Mondrian server. The client instance will save the server URL only after the request completes.  
The .addServer() method returns a promise, which will finally resolve to the ServerStatus object of the server, or will reject if the server isn't valid.

You can interact with the client the same way as you would with a @datawheel/tesseract-client instance

```js
client.cubes().then(cubes => {
  const cube = cubes[0];
  const query = cube.query;
  query.addDrilldown("Year.Year");
  query.addDrilldown("Geography.State");
  query.addMeasure("Admissions Total");
  return client.execQuery(query);
}).then(aggregation => {
  aggregation.data
})
```

## License

MIT © 2019 [Datawheel](https://datawheel.us/)
