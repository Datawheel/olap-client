import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import typescript from "@rollup/plugin-typescript";
import cleanup from "rollup-plugin-cleanup";
import license from "rollup-plugin-license";
import del from "rollup-plugin-delete";
import {execSync} from 'child_process';
import pkg from "./package.json";

const environment = process.env.NODE_ENV;
const inProduction = environment === "production";
const inDevelopment = environment === "development";

const sourcemap = inDevelopment ? "inline" : false;
const LICENSE_HEADER =
`${pkg.name} ${pkg.version} (${pkg.homepage})
rev ${execSync('git rev-parse --short HEAD')}
Copyright (c) Datawheel, LLC
Licensed under MIT`;

/** @return {import("rollup").RollupOptions} */
export default commandLineArgs => {
  return {
    input: "src/index.ts",
    output: [
      {
        file: pkg.main,
        format: "cjs",
        exports: "named",
        sourcemap
      },
      {
        file: pkg.module,
        format: "esm",
        exports: "named",
        sourcemap
      }
    ],
    external: Object.keys({...pkg.dependencies}),
    plugins: [
      del({
        targets: 'dist/*',
        runOnce: true
      }),
      replace({
        preventAssignment: true,
        values: {
          ENVIRONMENT: JSON.stringify(environment),
          "__VERSION__": JSON.stringify(pkg.version)
        }
      }),
      resolve({
        extensions: [".mjs", ".js", ".jsx", ".ts", ".tsx"],
        preferBuiltins: true
      }),
      typescript({
        sourceMap: Boolean(sourcemap)
      }),
      commonjs({
        include: ["node_modules/**"]
      }),
      license({
        banner: {
          commentStyle: "ignored",
          content: LICENSE_HEADER
        }
      }),
      cleanup()
    ],
    watch: {
      include: ["src/**"],
      exclude: "node_modules/**",
      clearScreen: !inProduction
    }
  };
};
