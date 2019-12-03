import formUrlEncoded from "form-urlencoded";
import Cube from "./cube";
import {Comparison, Format, Order} from "./enums";
import {ClientError} from "./errors";
import {LevelDescriptor} from "./interfaces";
import Level from "./level";
import Measure from "./measure";
import NamedSet from "./namedset";
import {pushUnique} from "./utils";

export type LevelReference = string | LevelDescriptor | Level;

export type Drillable = Level | NamedSet;
export type DrillableReference = LevelReference | Drillable;

export interface QueryFilter {
  measure: Measure;
  comparison: Comparison;
  value: number;
}

export interface QueryGrowth {
  level?: Level;
  measure?: Measure;
}

export interface QueryOptions {
  debug?: boolean;
  distinct?: boolean;
  nonempty?: boolean;
  parents?: boolean;
  sparse?: boolean;
}

export interface QueryProperty {
  level: Level;
  name: string;
}

export interface QueryRCA {
  level1?: Level;
  level2?: Level;
  measure?: Measure;
}

export interface QueryTopk {
  amount?: number;
  level?: Level;
  measure?: Measure;
  order?: Order;
}

export class Query {
  readonly cube: Cube;

  private captions: string[] = [];
  private cuts: {[drillable: string]: string[]} = {};
  private drilldowns: Drillable[] = [];
  private filters: QueryFilter[] = [];
  private format: Format = Format.jsonrecords;
  private growth: QueryGrowth = {};
  private limit: number = 0;
  private locale: string = "";
  private measures: Measure[] = [];
  private offset: number = 0;
  private options: QueryOptions = {
    debug: undefined,
    distinct: false,
    nonempty: true,
    parents: false,
    sparse: true
  };
  private orderDescendent: boolean;
  private orderProperty: string;
  private properties: QueryProperty[] = [];
  private rca: QueryRCA = {};
  private topk: QueryTopk = {};

  constructor(cube: Cube) {
    this.cube = cube;
  }

  addCaption(level: LevelReference, propertyName: string): this {
    const propertyFullName = this.getProperty(level, propertyName);
    this.captions.push(propertyFullName);
    return this;
  }

  addCut(drillableRef: DrillableReference, memberList: string[] = []): this {
    const drillable = this.getDrillable(drillableRef);
    const members = this.cuts[drillable.fullName] || [];
    memberList.forEach((member: string) => member && pushUnique(members, member));
    this.cuts[drillable.fullName] = members;
    return this;
  }

  addDrilldown(drillableRef: DrillableReference): this {
    const drillable = this.getDrillable(drillableRef);
    pushUnique(this.drilldowns, drillable);
    return this;
  }

  addFilter(measureRef: string | Measure, comparison: Comparison, value: number): this {
    const measure = this.cube.getMeasure(measureRef);
    this.filters.push({measure, comparison, value});
    return this;
  }

  addMeasure(measureRef: string | Measure): this {
    const measure = this.cube.getMeasure(measureRef);
    pushUnique(this.measures, measure);
    return this;
  }

  addProperty(levelRef: LevelReference, propertyName: string): this {
    const level = this.cube.getLevel(levelRef);
    if (level.hasProperty(propertyName)) {
      pushUnique(this.properties, {level, name: propertyName});
    }
    return this;
  }

  private getDrillable(drillableRef: DrillableReference): Drillable {
    return NamedSet.isNamedset(drillableRef) || Level.isLevel(drillableRef)
      ? drillableRef
      : this.cube.namedsetsByName[`${drillableRef}`] || this.cube.getLevel(drillableRef);
  }

  getParam(key: "captions"): string[];
  getParam(key: "cuts"): {[drillable: string]: string[]};
  getParam(key: "drilldowns"): Drillable[];
  getParam(key: "filters"): QueryFilter[];
  getParam(key: "format"): Format;
  getParam(key: "growth"): QueryGrowth;
  getParam(key: "limit"): number;
  getParam(key: "locale"): string;
  getParam(key: "measures"): Measure[];
  getParam(key: "offset"): number;
  getParam(key: "options"): QueryOptions;
  getParam(key: "orderDescendent"): boolean;
  getParam(key: "orderProperty"): string;
  getParam(key: "properties"): QueryProperty[];
  getParam(key: "rca"): QueryRCA;
  getParam(key: "topk"): QueryTopk;
  getParam(key: string): any {
    const value = this[key];
    return Array.isArray(value)
      ? value.slice()
      : typeof value === "object" ? {...value} : value;
  }

  private getProperty(levelRef: LevelReference, propertyName: string): string {
    const level = this.cube.getLevel(levelRef);
    if (!level.hasProperty(propertyName)) {
      throw new ClientError(
        `Property ${propertyName} does not exist in level ${level.fullName}`
      );
    }
    return `${level.fullName}.${propertyName}`;
  }

  setFormat(format: Format): this {
    this.format = format;
    return this;
  }

  setGrowth(levelRef: LevelReference, measureRef: string | Measure): this {
    this.growth = {
      level: this.cube.getLevel(levelRef),
      measure: this.cube.getMeasure(measureRef)
    };
    return this;
  }

  setLocale(locale: string): this {
    this.locale = locale;
    return this;
  }

  setOption(option: keyof QueryOptions, value: boolean): this {
    if (!this.options.hasOwnProperty(option)) {
      throw new ClientError(`Option ${option} is not a valid option.`);
    }
    this.options[option] = value;
    return this;
  }

  setPagination(limit: number, offset?: number): this {
    if (limit > 0) {
      this.limit = limit;
      this.offset = offset || 0;
    }
    else {
      this.limit = 0;
      this.offset = 0;
    }
    return this;
  }

  setRCA(
    levelRef1: LevelReference,
    levelRef2: LevelReference,
    measureRef: string | Measure
  ): this {
    const cube = this.cube;
    this.rca = {
      level1: cube.getLevel(levelRef1),
      level2: cube.getLevel(levelRef2),
      measure: cube.getMeasure(measureRef)
    };
    return this;
  }

  setSorting(measureRef: string | Measure, descendent: boolean): this;
  setSorting(levelRef: LevelReference, propertyName: string, descendent?: boolean): this;
  setSorting(arg1: LevelReference | Measure, arg2: string | boolean, arg3?: boolean) {
    const primaryObj =
      typeof arg1 === "string"
        ? this.cube.measuresByName[arg1] || this.cube.getLevel(arg1)
        : arg1;
    if (Level.isLevel(primaryObj) || Level.isLevelDescriptor(primaryObj)) {
      this.orderProperty = this.getProperty(primaryObj, arg2.toString());
      this.orderDescendent = Boolean(arg3);
    }
    else if (Measure.isMeasure(primaryObj)) {
      this.orderProperty = primaryObj.name;
      this.orderDescendent = Boolean(arg2);
    }
    return this;
  }

  setTop(
    amount: number,
    levelRef: LevelReference,
    measureRef: string | Measure,
    order: Order
  ): this {
    if (!isFinite(amount) || isNaN(amount)) {
      throw new TypeError(`Invalid value in argument amount: ${amount}`);
    }
    const cube = this.cube;
    this.topk = {
      amount,
      level: cube.getLevel(levelRef),
      measure: cube.getMeasure(measureRef),
      order: order || Order.desc
    };
    return this;
  }

  toJSON(): any {
    const cube = this.cube;
    return {
      captions: this.captions.slice(),
      cube: cube.name,
      cuts: {...this.cuts},
      drilldowns: this.drilldowns.slice(),
      filters: this.filters.slice(),
      format: this.format,
      growth: {...this.growth},
      limit: this.limit,
      locale: this.locale,
      measures: this.measures.slice(),
      offset: this.offset,
      order_desc: this.orderDescendent,
      order_prop: this.orderProperty,
      properties: this.properties,
      rca: {...this.rca},
      server: cube.server,
      topk: {...this.topk},
      ...this.options
    };
  }

  toString(): string {
    return formUrlEncoded(this.toJSON());
  }
}
