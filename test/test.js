const assert = require('assert');
const OlapClient = require('../dist/index.cjs.js');

//Tesseract datasource
const tDatasource = new OlapClient.TesseractDataSource("https://oec.world/olap-proxy/");
const tClient = new OlapClient.Client(tDatasource);

//Mondrian datasource
const mDatasource = new OlapClient.MondrianDataSource("https://vibranium-api.datausa.io/");
const mClient = new OlapClient.Client(mDatasource);

describe('Status', function () {
  describe('Tesseract', function () {
    it('Check status and software type', async function () {
      const statusObj = await tClient.checkStatus();
      assert.strictEqual(statusObj.software, 'tesseract-olap');
    });
  });
  describe('Mondrian', function () {
    it('Check status and software type', async function () {
      this.timeout(10000); //cubes from mondrian are slow
      const statusObj = await mClient.checkStatus();
      assert.strictEqual(statusObj.software, 'mondrian-rest');
    });
  });
});
