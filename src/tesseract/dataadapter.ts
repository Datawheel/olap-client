import urljoin from "url-join";
import { AggregatorType, DimensionType } from "../interfaces/enums";
import { PlainCube, PlainDimension, PlainHierarchy, PlainLevel, PlainMeasure, PlainMember, PlainProperty } from "../interfaces/plain";
import { asArray } from "../toolbox/collection";
import { TesseractCube, TesseractDimension, TesseractHierarchy, TesseractLevel, TesseractMeasure, TesseractMember, TesseractProperty } from "./schema";
import { joinFullName } from "./utils";

interface TesseractAdapterMeta {
  cube_name: string;
  cube_uri: string;
  dimension_fullname: string[];
  dimension_name: string;
  dimension_uri: string;
  hierarchy_fullname: string[];
  hierarchy_name: string;
  hierarchy_uri: string;
  level_fullname: string[];
  level_name: string;
  level_uri: string;
  locale: string;
  server_uri: string;
}

export function cubeAdapterFactory(
  meta: Pick<TesseractAdapterMeta, "server_uri">
): (json: TesseractCube) => PlainCube {
  return (json: TesseractCube) => {
    const cube_uri = urljoin(meta.server_uri, "cubes", encodeURIComponent(json.name));
    const contextMeta = { ...meta, cube_name: json.name, cube_uri };
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
  meta: Pick<TesseractAdapterMeta, "cube_name" | "cube_uri">
): (json: TesseractDimension) => PlainDimension {
  return (json: TesseractDimension) => {
    const dimension_name = json.name;
    const dimension_fullname = [dimension_name];
    const dimension_uri = urljoin(
      meta.cube_uri,
      "dimensions",
      encodeURIComponent(dimension_name)
    );
    const contextMeta = { ...meta, dimension_fullname, dimension_name, dimension_uri };
    return {
      _type: "dimension",
      annotations: json.annotations,
      cube: meta.cube_name,
      defaultHierarchy: json.default_hierarchy ?? json.hierarchies[0].name,
      dimensionType: DimensionType[json.type] ?? DimensionType.Standard,
      fullName: joinFullName(dimension_fullname),
      hierarchies: json.hierarchies.map(hierarchyAdapterFactory(contextMeta)),
      name: json.name,
      uri: dimension_uri
    };
  };
}

function hierarchyAdapterFactory(
  meta: Pick<
    TesseractAdapterMeta,
    "cube_name" | "dimension_fullname" | "dimension_name" | "dimension_uri"
  >
): (json: TesseractHierarchy) => PlainHierarchy {
  return (json: TesseractHierarchy) => {
    const hierarchy_name = json.name;
    const hierarchy_fullname = meta.dimension_fullname.concat(hierarchy_name);
    const hierarchy_uri = urljoin(
      meta.dimension_uri,
      "hierarchies",
      encodeURIComponent(hierarchy_name)
    );
    const contextMeta = { ...meta, hierarchy_fullname, hierarchy_name, hierarchy_uri };
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
  meta: Pick<
    TesseractAdapterMeta,
    | "cube_name"
    | "dimension_name"
    | "hierarchy_fullname"
    | "hierarchy_name"
    | "hierarchy_uri"
  >
): (json: TesseractLevel, depth: number) => PlainLevel {
  return (json: TesseractLevel, depth: number) => {
    const level_name = json.name;
    const level_fullname = meta.hierarchy_fullname.concat(level_name);
    const level_uri = urljoin(
      meta.hierarchy_uri,
      "levels",
      encodeURIComponent(json.name)
    );
    const contextMeta = { ...meta, level_name, level_uri };
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
      properties: asArray(json.properties).map(propertyAdapterFactory(contextMeta)),
      uniqueName: json.unique_name,
      uri: level_uri
    };
  };
}

function measureAdapterFactory(
  meta: Pick<TesseractAdapterMeta, "cube_name" | "cube_uri">
): (json: TesseractMeasure) => PlainMeasure {
  return (json: TesseractMeasure) => {
    const agg = json.aggregator.name?.toUpperCase();
    return {
      _type: "measure",
      aggregatorType: AggregatorType[agg] ?? AggregatorType.UNKNOWN,
      annotations: json.annotations,
      caption: json.name,
      cube: meta.cube_name,
      name: json.name,
      uri: urljoin(meta.cube_uri, "measures", encodeURIComponent(json.name))
    };
  };
}

export function memberAdapterFactory(
  meta: Pick<TesseractAdapterMeta, "level_name" | "locale" | "server_uri">
): (json: TesseractMember) => PlainMember {
  return (json: TesseractMember) => {
    const label = json[`${meta.locale} Label`] || json.Label || `${json.ID}`;
    return {
      _type: "member",
      ancestors: [],
      caption: label,
      children: [],
      fullName: joinFullName([meta.level_name, `${json.ID}`]),
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

function propertyAdapterFactory(
  meta: Pick<
    TesseractAdapterMeta,
    "cube_name" | "dimension_name" | "hierarchy_name" | "level_name" | "level_uri"
  >
): (json: TesseractProperty) => PlainProperty {
  return (json: TesseractProperty) => {
    return {
      _type: "property",
      annotations: json.annotations,
      captionSet: json.caption_set,
      cube: meta.cube_name,
      dimension: meta.dimension_name,
      hierarchy: meta.hierarchy_name,
      level: meta.level_name,
      name: json.name,
      uniqueName: json.unique_name,
      uri: urljoin(meta.level_uri, "properties", encodeURIComponent(json.name))
    };
  };
}
