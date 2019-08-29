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
    const contextMeta = {...meta, cube_uri};
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
      defaultHierarchy: json.default_hierarchy || json.hierarchies[0].name,
      dimensionType: switchCase<DimensionType>(
        DimensionType,
        json.type,
        DimensionType.Standard
      ),
      fullName: joinFullName(dimension_fullname),
      hierarchies: json.hierarchies.map(hierarchyAdapterFactory(contextMeta)),
      name: json.name,
      splitFullName: dimension_fullname,
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
      fullName: joinFullName(hierarchy_fullname),
      levels: json.levels.map(levelAdapterFactory(contextMeta)),
      name: json.name,
      splitFullName: hierarchy_fullname,
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
      depth: depth + 1,
      fullName: joinFullName(level_fullname),
      name: json.name,
      properties: json.properties,
      splitFullName: level_fullname,
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
      name: json.name,
      uri: urljoin(meta.cube_uri, "measures", encodeURIComponent(json.name))
    };
  };
}

export function memberAdapterFactory(
  meta: any
): (json: TesseractMember) => AdaptedMember {
  return (json: TesseractMember) => {
    return {
      _type: "member",
      key: json.ID,
      name: json.Label || `${json.ID}`,
      caption: json.Label || `${json.ID}`,
      uri: urljoin(
        meta.server_uri,
        `members?level=${encodeURIComponent(meta.level_name)}`
      )
    };
  };
}
