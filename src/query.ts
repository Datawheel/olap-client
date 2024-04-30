import formUrlEncoded from "form-urlencoded";
import type {Cube} from "./cube";
import type {QueryDescriptor} from "./interfaces/descriptors";
import {
  Calculation,
  Comparison,
  Direction,
  Format,
  type TimePrecision,
  type TimeValuePoint,
} from "./interfaces/enums";
import type {Level, LevelReference} from "./level";
import {type CalcOrMeasure, Measure} from "./measure";
import type {NamedSet} from "./namedset";
import type {Property, PropertyReference} from "./property";
import {asArray, pushUnique} from "./toolbox/collection";
import {
  calculationBuilders,
  extractQueryToJSON,
  extractQueryToSearchParams,
  getSourceForQuery,
  hydrateQueryFromJSON,
} from "./toolbox/query";
import {isQueryFilterConstraint} from "./toolbox/validation";

export type Drillable = Level | NamedSet;

export type DrillableReference = LevelReference | Drillable;

export type QueryCalc = QueryCalcGrowth | QueryCalcRca | QueryCalcTopk;

export interface QueryCalcGrowth {
  kind: "growth";
  category: Level;
  value: Measure;
}

export interface QueryCalcRca {
  kind: "rca";
  location: Level;
  category: Level;
  value: Measure;
}

export interface QueryCalcTopk {
  kind: "topk";
  amount: number;
  category: Level;
  value: CalcOrMeasure;
  order: Direction;
}

export interface QueryCut {
  drillable: Drillable;
  members: string[];
  isExclusive?: boolean;
  isForMatch?: boolean;
}

export interface QueryFilter {
  measure: CalcOrMeasure;
  const1: [Comparison, number];
  joint?: "and" | "or";
  const2?: [Comparison, number];
}

export type QueryOptions = Record<string, boolean | undefined>;

export interface QueryPagination {
  limit: number;
  offset: number;
}

export interface QuerySorting {
  direction?: Direction;
  property?: CalcOrMeasure | Property;
}

export interface QueryTimeframe {
  precision?: TimePrecision;
  value?: TimeValuePoint;
}

export class Query {
  readonly cube: Cube;

  private calculations: QueryCalc[] = [];
  private captions: Record<string, Property> = {};
  private cuts: Record<string, QueryCut> = {};
  private drilldowns: Drillable[] = [];
  private filters: QueryFilter[] = [];
  private format: Format = Format.jsonrecords;
  private locale = "";
  private measures: Measure[] = [];
  private options: QueryOptions = {};
  private pageLimit = 0;
  private pageOffset = 0;
  private properties: Record<string, Property> = {};
  private sortDirection: Direction | undefined;
  private sortProperty: CalcOrMeasure | Property | undefined;
  private timePrecision: TimePrecision | undefined;
  private timeValue: TimeValuePoint | undefined;

  constructor(cube: Cube) {
    this.cube = cube;
  }

  addCalculation(
    kind: "growth",
    params: {category: LevelReference; value: string | Measure},
  ): this;
  addCalculation(
    kind: "rca",
    params: {location: LevelReference; category: LevelReference; value: string | Measure},
  ): this;
  addCalculation(
    kind: "topk",
    params: {
      amount: number;
      category: LevelReference;
      value: string | CalcOrMeasure;
      order?: string;
    },
  ): this;
  addCalculation(kind: "growth" | "rca" | "topk", params: any): this {
    const builder = calculationBuilders[kind];
    if (builder == null) {
      throw new TypeError(`Invalid calculation type: ${kind} is not supported`);
    }
    this.calculations.push(builder(this.cube, params));
    return this;
  }

  addCaption(propertyRef: PropertyReference): this {
    const property = this.cube.getProperty(propertyRef);
    this.captions[property.level.fullName] = property;
    return this;
  }

  addCut(
    drillableRef: DrillableReference,
    memberList: string[] | number[] = [],
    options: {exclusive?: boolean; forMatch?: boolean} = {},
  ): this {
    const drillable = this.cube.getDrillable(drillableRef);
    const cut = this.cuts[drillable.fullName] || {
      drillable,
      isExclusive: options.exclusive != null ? Boolean(options.exclusive) : undefined,
      isForMatch: options.forMatch != null ? Boolean(options.forMatch) : undefined,
      members: [],
    };
    for (let index = 0; index < memberList.length; index++) {
      pushUnique(cut.members, `${memberList[index]}`);
    }
    this.cuts[drillable.fullName] = cut;
    return this;
  }

  addDrilldown(drillableRef: DrillableReference): this {
    const drillable = this.cube.getDrillable(drillableRef);
    pushUnique(this.drilldowns, drillable);
    return this;
  }

  addFilter(
    calcRef: string | Measure,
    constraint: [Comparison, number],
    joint?: "and" | "or",
    constraint2?: [Comparison, number],
  ): this {
    if (!isQueryFilterConstraint(constraint)) {
      throw new Error(`Invalid filter constraint: "${asArray(constraint).join(" ")}"`);
    }
    const calculation =
      Calculation[`${calcRef}` as Calculation] || this.cube.getMeasure(calcRef);

    if (joint && !["and", "or"].includes(joint)) {
      throw new Error(`Invalid filter joint: options are "and"/"or", used: "${joint}"`);
    }
    if (constraint2 && !isQueryFilterConstraint(constraint2)) {
      throw new Error(`Invalid filter constraint: "${asArray(constraint2).join(" ")}"`);
    }

    this.filters.push({
      measure: calculation,
      const1: [Comparison[constraint[0]], constraint[1]],
      joint: joint && constraint2 ? joint : undefined,
      // prettier-ignore
      const2:
        joint && constraint2 ? [Comparison[constraint2[0]], constraint2[1]] : undefined,
    });
    return this;
  }

  addMeasure(measureRef: string | Measure): this {
    const measure = this.cube.getMeasure(measureRef);
    pushUnique(this.measures, measure);
    return this;
  }

  addProperty(propertyRef: PropertyReference): this {
    const property = this.cube.getProperty(propertyRef);
    this.properties[property.fullName] = property;
    return this;
  }

  fromJSON(params: Partial<QueryDescriptor>): this {
    return hydrateQueryFromJSON(this, params);
  }

  getParam(key: "calculations"): QueryCalc[];
  getParam(key: "captions"): Property[];
  getParam(key: "cuts"): QueryCut[];
  getParam(key: "drilldowns"): Drillable[];
  getParam(key: "filters"): QueryFilter[];
  getParam(key: "format"): Format;
  getParam(key: "locale"): string;
  getParam(key: "measures"): Measure[];
  getParam(key: "options"): QueryOptions;
  getParam(key: "pagination"): QueryPagination;
  getParam(key: "properties"): Property[];
  getParam(key: "sorting"): QuerySorting;
  getParam(key: "time"): QueryTimeframe;
  getParam(key: string): any {
    if (key === "locale") return this.locale;
    if (key === "format") return this.format;
    if (key === "sorting") {
      return {direction: this.sortDirection, property: this.sortProperty} as QuerySorting;
    }
    if (key === "pagination") {
      return {limit: this.pageLimit, offset: this.pageOffset} as QueryPagination;
    }
    if (key === "time") {
      return {precision: this.timePrecision, value: this.timeValue} as QueryTimeframe;
    }
    if (key === "captions" || key === "cuts" || key === "properties") {
      return Object.values(this[key]);
    }
    const value = this[key as keyof this];
    return Array.isArray(value)
      ? value.slice()
      : typeof value === "object"
        ? {...value}
        : value;
  }

  setFormat(format: Format | `${Format}`): this {
    this.format = Format[format] || "";
    return this;
  }

  setLocale(locale: string): this {
    this.locale = `${locale || ""}`;
    return this;
  }

  setOption(option: string, value: boolean): this {
    if (value != null) {
      this.options[option] = Boolean(value);
    } else {
      delete this.options[option];
    }
    return this;
  }

  setPagination(limit: number, offset?: number): this {
    const isValid = limit > 0;
    this.pageLimit = isValid ? Math.max(0, limit) : 0;
    this.pageOffset = isValid ? Math.max(0, offset || 0) : 0;
    return this;
  }

  setSorting(
    sortProperty: string | CalcOrMeasure | PropertyReference,
    direction?: boolean | Direction | "asc" | "desc",
  ): this {
    if (!sortProperty) {
      this.sortDirection = undefined;
      this.sortProperty = undefined;
      return this;
    }

    const cube = this.cube;

    this.sortProperty =
      typeof sortProperty === "string"
        ? Calculation[sortProperty as Calculation] ||
          cube.measuresByName[sortProperty] ||
          cube.getProperty(sortProperty)
        : Measure.isMeasure(sortProperty)
          ? sortProperty
          : cube.getProperty(sortProperty);

    // cube.getProperty throws if invalid, so this area is safe
    this.sortDirection =
      typeof direction === "string"
        ? Direction[direction] || Direction.DESC
        : direction === false
          ? Direction.ASC
          : Direction.DESC;

    return this;
  }

  setTime(precision?: TimePrecision, value?: TimeValuePoint): this {
    const isValid = precision != null && value != null;
    this.timePrecision = isValid ? precision : undefined;
    this.timeValue = isValid ? value : undefined;
    return this;
  }

  toJSON(): QueryDescriptor {
    return extractQueryToJSON(this);
  }

  toSource(): string {
    return getSourceForQuery(this);
  }

  toString(kind?: string): string {
    if (typeof kind === "string") {
      const {datasource} = this.cube;
      return datasource.stringifyQueryURL(this, kind);
    }
    return formUrlEncoded(extractQueryToSearchParams(this), {
      ignorenull: true,
      skipIndex: true,
      sorted: true,
    });
  }
}
