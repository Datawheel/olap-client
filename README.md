# @datawheel/olap-client

> Multi-server javascript client, to interact with mondrian-rest and tesseract-olap servers.

[![NPM](https://img.shields.io/npm/v/@datawheel/olap-client.svg)](https://www.npmjs.com/package/@datawheel/olap-client)

## Install

```bash
npm install @datawheel/olap-client
```

## Usage

```js
import {Client} from '@datawheel/olap-client'

// Constructor only admits an array of server URLs
const client = new Client([
  "https://your.mondrian-rest.server/", 
  "https://a.tesseract-olap.server/"
]);

// More URLs can be added later
client.addServer("https://another.tesseract.olap/server/");

// You can interact with the client the same way as you would
// with a @datawheel/tesseract-client instance
client.cubes().then(cubes => {
  const cube = cubes[0];
  const query = cube.query;
  query.addDrilldown("Year.Year");
  query.addDrilldown("Geography.State");
  query.addMeasure("Admissions Total");
  return client.execQuery(query);
}).then(aggregation => {
  ...
})
```

## License

MIT © 2019 [Datawheel](https://datawheel.us/)
