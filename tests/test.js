const assert = require("node:assert");
const OlapClient = require("../dist/index.cjs.js");

const {MONDRIAN_SERVER, TESSERACT_SERVER} = process.env;

//Tesseract datasource
const tDatasource = new OlapClient.TesseractDataSource(TESSERACT_SERVER);
const tClient = new OlapClient.Client(tDatasource);

//Mondrian datasource
const mDatasource = new OlapClient.MondrianDataSource(MONDRIAN_SERVER);
const mClient = new OlapClient.Client(mDatasource);

describe("Status", () => {
  describe("Tesseract", () => {
    it("Check status and software type", async () => {
      const statusObj = await tClient.checkStatus();
      assert.strictEqual(statusObj.software, "tesseract-olap");
    });
  });

  describe("Mondrian", () => {
    it("Check status and software type", async function () {
      this.timeout(10000); //cubes from mondrian are slow
      const statusObj = await mClient.checkStatus();
      assert.strictEqual(statusObj.software, "mondrian-rest");
    });
  });
});
