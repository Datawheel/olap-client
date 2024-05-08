import urljoin from "url-join";
import type {QueryDescriptor} from "../interfaces/descriptors";
import {
  type AggregatorType,
  DimensionType,
  TimePrecision,
  TimeValue,
} from "../interfaces/enums";
import type {
  PlainCube,
  PlainDimension,
  PlainHierarchy,
  PlainLevel,
  PlainMeasure,
  PlainMember,
  PlainProperty,
} from "../interfaces/plain";
import type {Level} from "../level";
import type {Query} from "../query";
import {parseFilterConstraints} from "../tesseract/utils";
import {filterMap, splitTokens} from "../toolbox/collection";
import {hasProperty, isIn, isNumeric} from "../toolbox/validation";
import type {
  MemberRow,
  TesseractCube,
  TesseractDataRequest,
  TesseractDimension,
  TesseractHierarchy,
  TesseractLevel,
  TesseractMeasure,
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
    drilldowns: query.getParam("drilldowns").map(getName).join(","),
    measures: query.getParam("measures").map(getName).join(","),
    properties: query.getParam("properties").map(getName).join(","),
    exclude: filterMap(cuts, (item) => {
      if (!item.isExclusive) return null;
      return `${item.drillable.name}:${item.members.join(",")}`;
    }).join(","),
    include: filterMap(cuts, (item) => {
      if (item.isExclusive) return null;
      return `${item.drillable.name}:${item.members.join(",")}`;
    }).join(","),
    filters: query
      .getParam("filters")
      .map((item) => {
        const measure =
          typeof item.measure === "string" ? item.measure : item.measure.name;
        const filter = `${measure}.${item.const1.join(".")}`;
        return item.const2 ? `${filter}.${item.joint}.${item.const2.join(".")}` : filter;
      })
      .join(","),
    limit: `${pagination.limit},${pagination.offset}`,
    sort: !sorting.property
      ? undefined
      : typeof sorting.property === "string"
        ? `${sorting.property}.${sorting.direction}`
        : `${sorting.property.name}.${sorting.direction}`,
    time: time.precision ? `${time.precision}.${time.value}` : undefined,
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

export function memberAdapter(this: Level, item: MemberRow): PlainMember {
  return {
    _type: "member",
    ancestors: [],
    caption: item.caption,
    children: [],
    depth: this.depth,
    key: item.key,
    level: this.name,
    name: `${item.key}`,
    uri: urljoin(this.toString(), `_member?key=${item.key}`),
  };
}

export function hydrateQueryFromRequest(
  query: Query,
  request: Partial<TesseractDataRequest>,
): void {
  const cutsInclude = splitTokens(request.include, ";").map((token) => {
    const [level, members] = splitTokens(token, ":");
    return {level, members: members.split(","), exclusive: false};
  });
  const cutsExclude = splitTokens(request.exclude, ";").map((token) => {
    const [level, members] = splitTokens(token, ":");
    return {level, members: members.split(","), exclusive: true};
  });

  const [pagiLimit = "0", pagiOffset = "0"] = splitTokens(request.limit);
  const [sortProp, sortDir] = splitTokens(request.sort, ".");
  const [timeScale, timeAge] = splitTokens(request.time, ".");

  const params: Partial<QueryDescriptor> = {
    cube: request.cube,
    locale: request.locale,
    drilldowns: splitTokens(request.drilldowns).map((level) => ({
      level,
      toString: () => level,
    })),
    measures: splitTokens(request.measures),
    properties: splitTokens(request.properties).map((property) => ({
      property,
      toString: () => property,
    })),
    page_limit: Number.parseInt(pagiLimit),
    page_offset: Number.parseInt(pagiOffset),
    cuts: cutsInclude.concat(cutsExclude),
    filters: splitTokens(request.filters).map((token) => {
      const [measure, ...conditions] = token.split(".");
      const {const1, const2, joint} = parseFilterConstraints(conditions.join("."));
      return {measure, constraint: const1, joint, constraint2: const2};
    }),
    options: {
      parents: !!request.parents,
    },
  };

  if (sortProp) {
    params.sort_property = sortProp;
    params.sort_direction = sortDir || "asc";
  }

  if (timeScale && timeAge) {
    const scale = isIn(timeScale, TimePrecision) && TimePrecision[timeScale];
    const age = isIn(timeAge, TimeValue)
      ? TimeValue[timeAge]
      : isNumeric(timeAge) && timeAge;
    params.time = scale && age ? [scale, age] : undefined;
  }

  query.fromJSON(params);
}

export function isDataRequest(obj: unknown): obj is TesseractDataRequest {
  return (
    obj != null &&
    hasProperty(obj, "cube") &&
    hasProperty(obj, "drilldowns") &&
    hasProperty(obj, "measures")
  );
}
