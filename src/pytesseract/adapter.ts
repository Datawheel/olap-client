import formUrlEncoded from "form-urlencoded";
import urljoin from "url-join";
import type {QueryDescriptor} from "../interfaces/descriptors";
import {type AggregatorType, DimensionType} from "../interfaces/enums";
import type {
  PlainCube,
  PlainDimension,
  PlainHierarchy,
  PlainLevel,
  PlainMeasure,
  PlainMember,
  PlainProperty,
} from "../interfaces/plain";
import type {Query} from "../query";
import {filterMap, splitTokens} from "../toolbox/collection";
import type {
  MemberRow,
  TesseractCube,
  TesseractDataRequest,
  TesseractDimension,
  TesseractHierarchy,
  TesseractLevel,
  TesseractMeasure,
  TesseractMembersRequest,
  TesseractMembersResponse,
  TesseractProperty,
} from "./schema";

interface ContextMeta {
  cube: string;
  dimension: string;
  hierarchy: string;
  level: string;
  uri: string;
}

export function buildSearchParams(query: Query): TesseractDataRequest {
  const getName = (item: {name: string}) => item.name;

  const cuts = query.getParam("cuts");
  const options = query.getParam("options");
  const pagination = query.getParam("pagination");
  const sorting = query.getParam("sorting");
  const time = query.getParam("time");

  return {
    cube: query.cube.name,
    locale: query.getParam("locale"),
    drilldowns: query.getParam("drilldowns").map(getName),
    measures: query.getParam("measures").map(getName),
    properties: query.getParam("properties").map(getName),
    exclude: filterMap(cuts, (item) => {
      if (!item.isExclusive) return null;
      return `${item.drillable.name}:${item.members.join(",")}`;
    }),
    include: filterMap(cuts, (item) => {
      if (item.isExclusive) return null;
      return `${item.drillable.name}:${item.members.join(",")}`;
    }),
    filters: query.getParam("filters").map((item) => {
      const filter = `${item.measure}.${item.const1.join(".")}`;
      return item.const2 ? `${filter}.${item.joint}.${item.const2.join(".")}` : filter;
    }),
    limit: `${pagination.limit},${pagination.offset}`,
    sort: !sorting.property
      ? undefined
      : typeof sorting.property === "string"
        ? `${sorting.property}.${sorting.direction}`
        : `${sorting.property.name}.${sorting.direction}`,
    time: time.value ? `${time.value}.${time.precision}` : undefined,
    parents: options.parents || undefined,
  };
}

export function cubeAdapter(this: ContextMeta, item: TesseractCube): PlainCube {
  const uri = urljoin(this.uri, "cubes", encodeURIComponent(item.name));
  const ctx = {uri, cube: item.name};
  return {
    _type: "cube",
    annotations: item.annotations,
    caption: item.caption,
    dimensions: item.dimensions.map(dimensionAdapter, ctx),
    measures: item.measures.map(measureAdapter, ctx),
    name: item.name,
    namedsets: [],
    uri,
  };
}

export function measureAdapter(this: ContextMeta, item: TesseractMeasure): PlainMeasure {
  return {
    _type: "measure",
    aggregatorType: item.aggregator as AggregatorType,
    annotations: item.annotations,
    cube: this.cube,
    name: item.name,
    uri: urljoin(this.uri, "msr", encodeURIComponent(item.name)),
  };
}

export function dimensionAdapter(
  this: ContextMeta,
  item: TesseractDimension,
): PlainDimension {
  const uri = urljoin(this.uri, "dim", encodeURIComponent(item.name));
  const ctx = {...this, uri, dimension: item.name};
  return {
    _type: "dimension",
    annotations: item.annotations,
    caption: item.caption,
    cube: this.cube,
    defaultHierarchy: item.default_hierarchy,
    dimensionType:
      item.type === "standard" ? DimensionType.Standard : DimensionType[item.type],
    hierarchies: item.hierarchies.map(hierarchyAdapter, ctx),
    name: item.name,
    uri,
  };
}

export function hierarchyAdapter(
  this: ContextMeta,
  item: TesseractHierarchy,
): PlainHierarchy {
  const uri = urljoin(this.uri, encodeURIComponent(item.name));
  const ctx = {...this, uri, hierarchy: item.name};
  return {
    _type: "hierarchy",
    annotations: item.annotations,
    caption: item.caption,
    cube: this.cube,
    dimension: this.dimension,
    levels: item.levels.map(levelAdapter, ctx),
    name: item.name,
    uri,
  };
}

export function levelAdapter(this: ContextMeta, item: TesseractLevel): PlainLevel {
  const uri = urljoin(this.uri, encodeURIComponent(item.name));
  const ctx = {...this, uri, level: item.name};
  return {
    _type: "level",
    annotations: item.annotations,
    caption: item.caption,
    cube: this.cube,
    depth: item.depth,
    dimension: this.dimension,
    hierarchy: this.hierarchy,
    name: item.name,
    properties: item.properties.map(propertyAdapter, ctx),
    uniqueName: item.name,
    uri,
  };
}

export function propertyAdapter(
  this: ContextMeta,
  item: TesseractProperty,
): PlainProperty {
  return {
    _type: "property",
    annotations: item.annotations,
    name: item.name,
    uniqueName: item.name,
    uri: urljoin(this.uri, encodeURIComponent(item.name)),
  };
}

export function memberAdapter(
  this: TesseractMembersResponse,
  item: MemberRow,
): PlainMember {
  return {
    _type: "member",
    ancestors: [],
    caption: item.caption,
    children: [],
    depth: this.depth,
    key: item.key,
    level: this.name,
    name: `${item.key}`,
    uri: urljoin("/", this.name, `${item.key}`),
  };
}

export function stringifyRequest(
  request: TesseractDataRequest | TesseractMembersRequest,
): string {
  return formUrlEncoded(request, {
    ignoreEmptyArray: true,
    ignorenull: true,
    sorted: true,
  });
}

export function hydrateQueryFromRequest(
  query: Query,
  request: Partial<TesseractDataRequest>,
): void {
  if (request.cube && request.cube !== query.cube.name) {
    throw new Error("Provided Query object doesn't match cube in request.");
  }

  const params: Partial<QueryDescriptor> = {
    drilldowns: splitTokens(request.drilldowns, ","),
    measures: splitTokens(request.measures, ","),
    locale: request.locale,
  };

  query.fromJSON(params);
}

export function isDataRequest(obj: unknown): obj is TesseractDataRequest {
  return (
    typeof obj === "object" &&
    Object.prototype.hasOwnProperty.call(obj, "cube") &&
    Object.prototype.hasOwnProperty.call(obj, "drilldowns") &&
    Object.prototype.hasOwnProperty.call(obj, "measures")
  );
}
