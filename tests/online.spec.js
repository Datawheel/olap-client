const assert = require("node:assert");
const {TesseractDataSource, MondrianDataSource, PyTesseractDataSource, Client} = require("../dist/index.cjs.js");

const {MONDRIAN_SERVER, TESSERACT_SERVER, PYTESSERACT_SERVER} = process.env;

describe("Online remote servers", () => {
  "Ensures the servers we intend to use are online";

  describe("PyTesseract", () => {
    let client;

    before(() => {
      const ds = new PyTesseractDataSource(PYTESSERACT_SERVER);
      client = new Client(ds);
    });

    it("Check status and software type", async () => {
      const statusObj = await client.checkStatus();
      assert.strictEqual(statusObj.software, PyTesseractDataSource.softwareName);
      assert.ok(statusObj.online);
    });
  });

  describe("Tesseract", () => {
    let client;

    before(() => {
      const ds = new TesseractDataSource(TESSERACT_SERVER);
      client = new Client(ds);
    });

    it("Check status and software type", async () => {
      const statusObj = await client.checkStatus();
      assert.strictEqual(statusObj.software, TesseractDataSource.softwareName);
      assert.ok(statusObj.online);
    });
  });

  describe("Mondrian", () => {
    let client;

    before(() => {
      const ds = new MondrianDataSource(MONDRIAN_SERVER);
      client = new Client(ds);
    });

    it("Check status and software type", async function () {
      this.timeout(10000); //cubes from mondrian are slow
      const statusObj = await client.checkStatus();
      assert.strictEqual(statusObj.software, MondrianDataSource.softwareName);
      assert.ok(statusObj.online);
    });
  });
});
