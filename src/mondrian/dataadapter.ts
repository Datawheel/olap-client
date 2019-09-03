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

interface CubeAdapterMeta {
  server_uri: string;
}

export function cubeAdapterFactory(
  meta: CubeAdapterMeta
): (json: MondrianCube) => AdaptedCube {
  return (json: MondrianCube) => {
    const cube_uri = urljoin(meta.server_uri, "cubes", encodeURIComponent(json.name));
    const contextMeta = {...meta, cube_name: json.name, cube_uri};
    return {
      _type: "cube",
      annotations: json.annotations,
      dimensions: json.dimensions.map(dimensionAdapterFactory(contextMeta)),
      measures: json.measures.map(measureAdapterFactory(contextMeta)),
      name: json.name,
      namedsets: json.named_sets.map(namedSetAdapterFactory(contextMeta)),
      uri: cube_uri
    };
  };
}

function dimensionAdapterFactory(
  meta: any
): (json: MondrianDimension) => AdaptedDimension {
  return (json: MondrianDimension) => {
    const dimension_uri = urljoin(
      meta.cube_uri,
      "dimensions",
      encodeURIComponent(json.name)
    );
    const contextMeta = {...meta, dimension_name: json.name, dimension_uri};
    return {
      _type: "dimension",
      annotations: json.annotations,
      cube: meta.cube_name,
      defaultHierarchy: json.hierarchies[0].name,
      dimensionType: switchCase<DimensionType>(
        DimensionType,
        json.type,
        DimensionType.Standard
      ),
      hierarchies: json.hierarchies.map(hierarchyAdapterFactory(contextMeta)),
      name: json.name,
      uri: dimension_uri
    };
  };
}

function hierarchyAdapterFactory(
  meta: any
): (json: MondrianHierarchy) => AdaptedHierarchy {
  return (json: MondrianHierarchy) => {
    const hierarchy_uri = urljoin(
      meta.dimension_uri,
      "hierarchies",
      encodeURIComponent(json.name)
    );
    const contextMeta = {...meta, hierarchy_name: json.name, hierarchy_uri};
    return {
      _type: "hierarchy",
      allMemberName: json.all_member_name,
      annotations: {},
      cube: meta.cube_name,
      dimension: meta.dimension_name,
      levels: json.levels.slice(1).map(levelAdapterFactory(contextMeta)),
      name: json.name,
      uri: hierarchy_uri
    };
  };
}

function levelAdapterFactory(meta: any): (json: MondrianLevel) => AdaptedLevel {
  return (json: MondrianLevel) => {
    return {
      _type: "level",
      annotations: json.annotations,
      caption: json.caption,
      cube: meta.cube_name,
      depth: json.depth,
      dimension: meta.dimension_name,
      fullName: json.full_name,
      hierarchy: meta.hierarchy_name,
      name: json.name,
      properties: json.properties.map(propertyAdapterFactory),
      uri: urljoin(meta.hierarchy_uri, "levels", encodeURIComponent(json.name))
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
      cube: meta.cube_name,
      fullName: json.full_name,
      name: json.name,
      uri: urljoin(meta.cube_uri, "measures", encodeURIComponent(json.name))
    };
  };
}

export function memberAdapterFactory(meta: any): (json: MondrianMember) => AdaptedMember {
  return (json: MondrianMember) => {
    return {
      _type: "member",
      ancestors: ensureArray(json.ancestors).map(memberAdapterFactory(meta)),
      caption: json.caption,
      children: ensureArray(json.children).map(memberAdapterFactory(meta)),
      depth: json.depth,
      fullName: json.full_name,
      // isAllMember: json["all_member?"],
      // isDrillable: json["drillable?"],
      key: json.key,
      level: json.level_name,
      name: json.name,
      numChildren: json.num_children,
      parentName: json.parent_name,
      uri: urljoin(
        meta.hierarchy_uri,
        "levels",
        encodeURIComponent(json.level_name),
        "members",
        `${json.key}`
      )
    };
  };
}

function namedSetAdapterFactory(meta: any): (json: MondrianNamedSet) => AdaptedNamedSet {
  return (json: MondrianNamedSet) => {
    return {
      _type: "namedset",
      annotations: json.annotations,
      cube: meta.cube_name,
      dimension: json.dimension,
      hierarchy: json.hierarchy,
      level: json.level,
      name: json.name,
      uri: urljoin(meta.cube_uri, "namedsets", encodeURIComponent(json.name))
    };
  };
}

function propertyAdapterFactory(name: string): AdaptedProperty {
  return {annotations: {}, name};
}
