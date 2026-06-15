import {execSync} from "node:child_process";
import {defineConfig} from "tsdown";
import pkg from "./package.json" with {type: "json"};

const gitHash = execSync("git rev-parse --short HEAD");
const LICENSE_HEADER = `/*!
 * @module ${pkg.name}
 * @version ${pkg.version} (rev ${gitHash.toString().trim()})
 * @copyright Datawheel, LLC
 * @license MIT
 * @see {@link ${pkg.homepage}}
 */`;

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  clean: true,
  dts: true,
  treeshake: true,
  banner: {
    js: LICENSE_HEADER,
  },
});
