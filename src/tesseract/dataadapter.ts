import urljoin from "url-join";
import {AggregatorType, DimensionType} from "../enums";
import {
  AdaptedCube,
  AdaptedDimension,
  AdaptedHierarchy,
  AdaptedLevel,
  AdaptedMeasure,
  AdaptedMember
} from "../interfaces";
import {switchCase} from "../utils";
import {
  TesseractCube,
  TesseractDimension,
  TesseractHierarchy,
  TesseractLevel,
  TesseractMeasure,
  TesseractMember
} from "./schema";
import {joinFullName} from "./utils";

interface CubeAdapterMeta {
  server_uri: string;
}

export function cubeAdapterFactory(
  meta: CubeAdapterMeta
): (json: TesseractCube) => AdaptedCube {
  return (json: TesseractCube) => {
    const cube_uri = urljoin(meta.server_uri, "cubes", encodeURIComponent(json.name));
    const contextMeta = {...meta, cube_name: json.name, cube_uri};
    return {
      _type: "cube",
      annotations: json.annotations,
      dimensions: json.dimensions.map(dimensionAdapterFactory(contextMeta)),
      measures: json.measures.map(measureAdapterFactory(contextMeta)),
      name: json.name,
      namedsets: [],
      uri: cube_uri
    };
  };
}

function dimensionAdapterFactory(
  meta: any
): (json: TesseractDimension) => AdaptedDimension {
  return (json: TesseractDimension) => {
    const dimension_name = json.name;
    const dimension_fullname = [dimension_name];
    const dimension_uri = urljoin(
      meta.cube_uri,
      "dimensions",
      encodeURIComponent(dimension_name)
    );
    const contextMeta = {...meta, dimension_fullname, dimension_name, dimension_uri};
    return {
      _type: "dimension",
      annotations: json.annotations,
      cube: meta.cube_name,
      defaultHierarchy: json.default_hierarchy || json.hierarchies[0].name,
      dimensionType: switchCase<DimensionType>(
        DimensionType,
        json.type,
        DimensionType.Standard
      ),
      fullName: joinFullName(dimension_fullname),
      hierarchies: json.hierarchies.map(hierarchyAdapterFactory(contextMeta)),
      name: json.name,
      uri: dimension_uri
    };
  };
}

function hierarchyAdapterFactory(
  meta: any
): (json: TesseractHierarchy) => AdaptedHierarchy {
  return (json: TesseractHierarchy) => {
    const hierarchy_name = json.name;
    const hierarchy_fullname = meta.dimension_fullname.concat(hierarchy_name);
    const hierarchy_uri = urljoin(
      meta.dimension_uri,
      "hierarchies",
      encodeURIComponent(hierarchy_name)
    );
    const contextMeta = {...meta, hierarchy_fullname, hierarchy_name, hierarchy_uri};
    return {
      _type: "hierarchy",
      annotations: json.annotations,
      cube: meta.cube_name,
      dimension: meta.dimension_name,
      fullName: joinFullName(hierarchy_fullname),
      levels: json.levels.map(levelAdapterFactory(contextMeta)),
      name: json.name,
      uri: hierarchy_uri
    };
  };
}

function levelAdapterFactory(
  meta: any
): (json: TesseractLevel, depth: number) => AdaptedLevel {
  return (json: TesseractLevel, depth: number) => {
    const level_name = json.name;
    const level_fullname = meta.hierarchy_fullname.concat(level_name);
    return {
      _type: "level",
      annotations: json.annotations,
      caption: json.name,
      cube: meta.cube_name,
      depth: depth + 1,
      dimension: meta.dimension_name,
      fullName: joinFullName(level_fullname),
      hierarchy: meta.hierarchy_name,
      name: json.name,
      properties: json.properties,
      uri: urljoin(meta.hierarchy_uri, "levels", encodeURIComponent(json.name))
    };
  };
}

function measureAdapterFactory(meta: any): (json: TesseractMeasure) => AdaptedMeasure {
  return (json: TesseractMeasure) => {
    return {
      _type: "measure",
      aggregatorType: switchCase<AggregatorType>(
        AggregatorType,
        json.aggregator.name.toUpperCase(),
        AggregatorType.UNKNOWN
      ),
      annotations: json.annotations,
      caption: json.name,
      cube: meta.cube_name,
      name: json.name,
      uri: urljoin(meta.cube_uri, "measures", encodeURIComponent(json.name))
    };
  };
}

export function memberAdapterFactory(
  meta: any
): (json: TesseractMember) => AdaptedMember {
  return (json: TesseractMember) => {
    const label = json[`${meta.locale} Label`] || json.Label || `${json.ID}`;
    return {
      _type: "member",
      ancestors: [],
      caption: label,
      children: [],
      fullName: joinFullName([meta.level_name, json.ID]),
      key: json.ID,
      level: meta.level_name,
      name: label,
      uri: urljoin(
        meta.server_uri,
        `members?level=${encodeURIComponent(meta.level_name)}`
      )
    };
  };
}
