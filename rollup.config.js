import babel from "rollup-plugin-babel";
import cleanup from "rollup-plugin-cleanup";
import commonjs from "rollup-plugin-commonjs";
import resolve from "rollup-plugin-node-resolve";
import replace from "rollup-plugin-replace";
import license from "rollup-plugin-license";
import typescript from "rollup-plugin-typescript2";
import {execSync} from 'child_process';
import pkg from "./package.json";

const environment = process.env.NODE_ENV;
const inProduction = environment === "production";
const inDevelopment = environment === "development";

const sourcemap = inDevelopment ? "inline" : false;
const LICENSE_HEADER =
`${pkg.name} ${pkg.version} (${pkg.homepage})
rev ${execSync('git rev-parse --short HEAD')}
Copyright 2019 Datawheel, LLC
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
      replace({
        ENVIRONMENT: JSON.stringify(environment),
        "__VERSION__": JSON.stringify(pkg.version)
      }),
      resolve({
        extensions: [".mjs", ".js", ".jsx", ".ts", ".tsx"],
        preferBuiltins: true
      }),
      babel({
        exclude: "node_modules/**"
      }),
      typescript({
        clean: true,
        rollupCommonJSResolveHack: true,
        useTsconfigDeclarationDir: true
      }),
      commonjs({
        include: ["node_modules/**"]
      }),
      license({
        banner: LICENSE_HEADER
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
