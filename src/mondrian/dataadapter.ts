import urljoin from "url-join";
import {AggregatorType, DimensionType} from "../enums";
import {
  AdaptedCube,
  AdaptedDimension,
  AdaptedHierarchy,
  AdaptedLevel,
  AdaptedMeasure,
  AdaptedMember,
  AdaptedNamedSet,
  AdaptedProperty
} from "../interfaces";
import {ensureArray, switchCase} from "../utils";
import {
  MondrianCube,
  MondrianDimension,
  MondrianHierarchy,
  MondrianLevel,
  MondrianMeasure,
  MondrianMember,
  MondrianNamedSet
} from "./schema";
import {splitFullName} from "./utils";

interface CubeAdapterMeta {
  server_uri: string;
}

export function cubeAdapterFactory(
  meta: CubeAdapterMeta
): (json: MondrianCube) => AdaptedCube {
  return (json: MondrianCube) => {
    const contextMeta = {
      ...meta,
      cube_uri: urljoin(meta.server_uri, "cubes", encodeURIComponent(json.name))
    };
    return {
      _type: "cube",
      annotations: json.annotations,
      dimensions: json.dimensions.map(dimensionAdapterFactory(contextMeta)),
      measures: json.measures.map(measureAdapterFactory(contextMeta)),
      name: json.name,
      namedsets: json.named_sets.map(namedSetAdapterFactory(contextMeta)),
      uri: contextMeta.cube_uri
    };
  };
}

function dimensionAdapterFactory(
  meta: any
): (json: MondrianDimension) => AdaptedDimension {
  return (json: MondrianDimension) => {
    const contextMeta = {
      ...meta,
      dimension_uri: urljoin(meta.cube_uri, "dimensions", encodeURIComponent(json.name))
    };
    return {
      _type: "dimension",
      annotations: json.annotations,
      defaultHierarchy: json.hierarchies[0].name,
      dimensionType: switchCase<DimensionType>(
        DimensionType,
        json.type,
        DimensionType.Standard
      ),
      hierarchies: json.hierarchies.map(hierarchyAdapterFactory(contextMeta)),
      name: json.name,
      uri: contextMeta.dimension_uri
    };
  };
}

function hierarchyAdapterFactory(
  meta: any
): (json: MondrianHierarchy) => AdaptedHierarchy {
  return (json: MondrianHierarchy) => {
    const contextMeta = {
      ...meta,
      hierarchy_uri: urljoin(
        meta.dimension_uri,
        "hierarchies",
        encodeURIComponent(json.name)
      )
    };
    return {
      _type: "hierarchy",
      allMemberName: json.all_member_name,
      annotations: {},
      levels: json.levels.slice(1).map(levelAdapterFactory(contextMeta)),
      name: json.name,
      uri: contextMeta.hierarchy_uri
    };
  };
}

function levelAdapterFactory(meta: any): (json: MondrianLevel) => AdaptedLevel {
  return (json: MondrianLevel) => {
    const contextMeta = {
      ...meta,
      level_uri: urljoin(meta.hierarchy_uri, "levels", encodeURIComponent(json.name))
    };
    return {
      _type: "level",
      annotations: json.annotations,
      caption: json.caption,
      depth: json.depth,
      fullName: json.full_name,
      name: json.name,
      properties: json.properties.map(propertyAdapterFactory),
      splitFullName: splitFullName(json.full_name),
      uri: contextMeta.level_uri
    };
  };
}

function measureAdapterFactory(meta: any): (json: MondrianMeasure) => AdaptedMeasure {
  return (json: MondrianMeasure) => {
    return {
      _type: "measure",
      aggregatorType: AggregatorType[json.aggregator] || AggregatorType.UNKNOWN,
      annotations: json.annotations,
      caption: json.caption,
      fullName: json.full_name,
      name: json.name,
      splitFullName: splitFullName(json.full_name),
      uri: urljoin(meta.cube_uri, "measures", encodeURIComponent(json.name))
    };
  };
}

export function memberAdapterFactory(meta: any): (json: MondrianMember) => AdaptedMember {
  return (json: MondrianMember) => {
    return {
      _type: "member",
      // allMember: json["all_member?"],
      ancestors: ensureArray(json.ancestors).map(memberAdapterFactory(meta)),
      caption: json.caption,
      children: ensureArray(json.children).map(memberAdapterFactory(meta)),
      depth: json.depth,
      // drillable: json["drillable?"],
      fullName: json.full_name,
      key: json.key,
      name: json.name,
      numChildren: json.num_children,
      parentName: json.parent_name,
      splitFullName: splitFullName(json.full_name),
      uri: urljoin(
        meta.hierarchy_uri,
        "levels",
        encodeURIComponent(json.level_name),
        "members"
      )
    };
  };
}

function namedSetAdapterFactory(meta: any): (json: MondrianNamedSet) => AdaptedNamedSet {
  return (json: MondrianNamedSet) => {
    return {
      _type: "namedset",
      annotations: json.annotations,
      level: [json.dimension, json.hierarchy, json.level],
      name: json.name,
      uri: urljoin(meta.level_uri)
    };
  };
}

function propertyAdapterFactory(name: string): AdaptedProperty {
  return {annotations: {}, name};
}
