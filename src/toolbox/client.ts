import Axios, {type AxiosError, type AxiosRequestConfig, type AxiosResponse} from "axios";
import urljoin from "url-join";
import type {Cube} from "../cube";
import type {IClient, IDataSource} from "../interfaces/contracts";
import {Level, type LevelReference} from "../level";
import {MondrianDataSource} from "../mondrian/datasource";
import {PyTesseractDataSource} from "../pytesseract/datasource";
import {TesseractDataSource} from "../tesseract/datasource";
import {iteratorMatch} from "./collection";
import {ServerError} from "./errors";

export interface ParseURLOptions {
  anyServer: boolean;
  exclude: string[];
  include: string[];
  filter: (key: string, value: string | boolean | string[]) => boolean;
}

export type ServerConfig = string | AxiosRequestConfig;

export function applyParseUrlRules<T extends Record<string, any>>(
  qp: T,
  options: Partial<ParseURLOptions> = {},
): Partial<T> {
  const {exclude, include, filter} = options;

  const always = () => true;
  let tester = typeof filter === "function" ? filter : always;

  if (exclude || include) {
    const included = Array.isArray(include)
      ? (key: string) =>
          include.reduce((result, pattern) => result && key === pattern, true)
      : always;
    const notExcluded = Array.isArray(exclude)
      ? (key: string) =>
          exclude.reduce((result, pattern) => result && key !== pattern, true)
      : always;

    tester = (key: string) => included(key) && notExcluded(key);
  }

  const qpFinal: Partial<T> = {};
  Object.keys(qp).forEach((key) => {
    const value = qp[key];
    tester(key, value) && Object.defineProperty(qpFinal, key, {enumerable: true, value});
  });

  return qpFinal;
}

export function getLevel(
  client: IClient,
  levelRef: LevelReference,
  selectorFn?: (cubes: Cube[]) => Cube,
): Promise<Level> {
  // prettier-ignore
  const cubeName = Level.isLevel(levelRef)
    ? levelRef.cube.name
    : Level.isLevelDescriptor(levelRef)
      ? levelRef.cube
      : /* else */ undefined;

  if (cubeName) {
    return client.getCube(cubeName, selectorFn).then((cube) => cube.getLevel(levelRef));
  }

  return client.getCubes().then((cubes: Cube[]) => {
    let n = cubes.length;
    while (n--) {
      const cube = cubes[n];
      const match = iteratorMatch(cube.levelIterator, levelRef);
      if (match != null) {
        return match;
      }
    }
    throw new Error(`No level matched the descriptor ${JSON.stringify(levelRef)}`);
  });
}

export function inferDataSource(config: ServerConfig): Promise<IDataSource> {
  if (typeof config === "string") {
    config = {url: config};
  }
  const {url, ...reqConfig} = config;

  if (!url) {
    const reason = `DataSource can be built with a string URL or an object with the 'url' property.
Received ${JSON.stringify(config)}`;
    return Promise.reject(new Error(reason));
  }

  const cubesUrl = urljoin(url, "cubes");

  return Axios({...reqConfig, url: cubesUrl}).then(
    (response: AxiosResponse) => {
      if (response.status === 200 && "cubes" in response.data) {
        let ds: IDataSource;
        if ("module" in response.data) {
          ds = new PyTesseractDataSource(url);
        } else if ("name" in response.data) {
          ds = new TesseractDataSource(url);
        } else {
          ds = new MondrianDataSource(url);
        }
        ds.setRequestConfig(reqConfig);
        return ds;
      }
      throw new ServerError(response, `URL is not a known OLAP server: ${url}`);
    },
    (error: AxiosError) => {
      error.message += `\nURL is not a known OLAP server: ${url}`;
      throw error;
    },
  );
}

export function matchCubeNameFromURL(url: string): string {
  const cubeMatch = /\/cubes\/([^\/]+)\/|\bcube=([^&]+)&/.exec(url);
  if (cubeMatch) {
    return cubeMatch[1] || cubeMatch[2];
  }
  throw new Error(`Provided URL is not a valid Query URL: ${url}`);
}
