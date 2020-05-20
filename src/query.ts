import formUrlEncoded from "form-urlencoded";
import Cube from "./cube";
import {
  CalculationName,
  Comparison,
  Direction,
  Format,
  TimePrecision,
  TimeValue
} from "./enums";
import { ClientError } from "./errors";
import {
  Calculation,
  Drillable,
  DrillableReference,
  LevelReference,
  QueryCut,
  QueryFilter,
  QueryGrowth,
  QueryOptions,
  QueryPagination,
  QueryProperty,
  QueryRCA,
  QuerySorting,
  QueryTimeframe,
  QueryTopk
} from "./interfaces";
import Level from "./level";
import Measure from "./measure";
import NamedSet from "./namedset";
import {
  ifNotEmpty,
  ifValid,
  isNumeric,
  isQueryGrowth,
  isQueryRCA,
  isQueryTopk,
  pushUnique,
  queryToSource
} from "./utils";

export class Query {
  readonly cube: Cube;

  private captions: Record<string, QueryProperty> = {};
  private cuts: Record<string, QueryCut> = {};
  private drilldowns: Drillable[] = [];
  private filters: QueryFilter[] = [];
  private format: Format = Format.jsonrecords;
  private growth?: QueryGrowth;
  private limitAmount: number = 0;
  private limitOffset: number = 0;
  private locale: string = "";
  private measures: Measure[] = [];
  private options: QueryOptions = {
    debug: undefined,
    distinct: undefined,
    exclude_default_members: undefined,
    nonempty: undefined,
    parents: undefined,
    sparse: undefined
  };
  private properties: Record<string, QueryProperty> = {};
  private rca?: QueryRCA;
  private sortDirection: Direction | undefined;
  private sortProperty: Calculation | QueryProperty | undefined;
  private timePrecision: "year" | "quarter" | "month" | "week" | "day" | undefined;
  private timeValue: "latest" | "oldest" | undefined;
  private topk?: QueryTopk;

  constructor(cube: Cube) {
    this.cube = cube;
  }

  addCaption(level: LevelReference, propertyName: string): this {
    const property = this.getProperty(level, propertyName);
    this.captions[property.level.fullName] = property;
    return this;
  }

  addCut(drillableRef: DrillableReference, memberList: string[] = []): this {
    const drillable = this.getDrillable(drillableRef);
    const cut = this.cuts[drillable.fullName] || { drillable, members: [] };
    // must address if key is 0
    memberList.forEach(
      (member: string) => (member || isNumeric(member)) && pushUnique(cut.members, member)
    );
    this.cuts[drillable.fullName] = cut;
    return this;
  }

  addDrilldown(drillableRef: DrillableReference): this {
    const drillable = this.getDrillable(drillableRef);
    pushUnique(this.drilldowns, drillable);
    return this;
  }

  addFilter(
    calcRef: string | Measure,
    constraint1: [Comparison, number],
    joint?: "and" | "or",
    constraint2?: [Comparison, number]
  ): this {
    if (!isNumeric(constraint1[1])) {
      throw new ClientError(`Invalid value: "${constraint1[1]}" is not numeric.`);
    }
    const calculation = CalculationName[`${calcRef}`] || this.cube.getMeasure(calcRef);
    if (joint && !constraint2) {
      throw new ClientError(
        `Undefined second constraint: ${calculation} ${constraint1} ${joint} undefined`
      );
    }
    if (constraint2 && !isNumeric(constraint2[1])) {
      throw new ClientError(`Invalid value: "${constraint2[1]}" is not numeric.`);
    }
    this.filters.push({
      measure: calculation,
      const1: [Comparison[constraint1[0]], constraint1[1]],
      joint,
      const2: constraint2 ? [Comparison[constraint2[0]], constraint2[1]] : undefined
    });
    return this;
  }

  addMeasure(measureRef: string | Measure): this {
    const measure = this.cube.getMeasure(measureRef);
    pushUnique(this.measures, measure);
    return this;
  }

  addProperty(levelRef: LevelReference, propertyName: string): this {
    const property = this.getProperty(levelRef, propertyName);
    if (property) {
      const propertyKey = `${property.level.fullName}.${property.name}`;
      this.properties[propertyKey] = property;
    }
    return this;
  }

  private getDrillable(drillableRef: DrillableReference): Drillable {
    return NamedSet.isNamedset(drillableRef) || Level.isLevel(drillableRef)
      ? drillableRef
      : this.cube.namedsetsByName[`${drillableRef}`] || this.cube.getLevel(drillableRef);
  }

  getParam(key: "captions"): QueryProperty[];
  getParam(key: "cuts"): QueryCut[];
  getParam(key: "drilldowns"): Drillable[];
  getParam(key: "filters"): QueryFilter[];
  getParam(key: "format"): Format;
  getParam(key: "growth"): QueryGrowth | undefined;
  getParam(key: "locale"): string;
  getParam(key: "measures"): Measure[];
  getParam(key: "options"): QueryOptions;
  getParam(key: "pagination"): QueryPagination;
  getParam(key: "properties"): QueryProperty[];
  getParam(key: "rca"): QueryRCA | undefined;
  getParam(key: "sorting"): QuerySorting;
  getParam(key: "time"): QueryTimeframe;
  getParam(key: "topk"): QueryTopk | undefined;
  getParam(key: string): any {
    if (key === "sorting") {
      return { direction: this.sortDirection, property: this.sortProperty };
    }
    if (key === "pagination") {
      return { amount: this.limitAmount, offset: this.limitOffset };
    }
    if (key === "time") {
      return { precision: this.timePrecision, value: this.timeValue };
    }
    const value = this[key];
    if ("captions|cuts|properties".indexOf(key) > -1) {
      return Object.values(value);
    }
    return Array.isArray(value)
      ? value.slice()
      : typeof value === "object"
      ? { ...value }
      : value;
  }

  private getProperty(levelRef: LevelReference, propertyName: string): QueryProperty {
    const level = this.cube.getLevel(levelRef);
    if (!level.hasProperty(propertyName)) {
      const reason = `Property ${propertyName} does not exist in level ${level.fullName}`;
      throw new ClientError(reason);
    }
    return { level, name: propertyName };
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
    this.locale = `${locale || ""}`;
    return this;
  }

  setOption(option: keyof QueryOptions, value: boolean): this {
    this.options[option] = value != null ? Boolean(value) : undefined;
    return this;
  }

  setPagination(limit: number, offset?: number): this {
    if (limit > 0) {
      this.limitAmount = limit;
      this.limitOffset = offset || 0;
    } else {
      this.limitAmount = 0;
      this.limitOffset = 0;
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

  setSorting(): this;
  setSorting(measureRef: string | Calculation, direction: boolean | Direction): this;
  setSorting(
    levelRef: LevelReference,
    propertyName: string,
    descendent?: boolean | Direction
  ): this;
  setSorting(
    arg0?: LevelReference | Calculation | null,
    arg1?: string | boolean | Direction,
    arg2?: boolean | Direction
  ): this {
    if (!arg0) {
      this.sortDirection = undefined;
      this.sortProperty = undefined;
      return this;
    }

    const directionParse = (value: boolean | string | undefined): Direction =>
      value === true ? Direction.DESC : Direction[`${value}`] || Direction.DESC;

    const primaryObj =
      typeof arg0 === "string"
        ? CalculationName[arg0] ||
          this.cube.measuresByName[arg0] ||
          this.cube.getLevel(arg0)
        : arg0;

    if (Measure.isCalculation(primaryObj)) {
      this.sortProperty = primaryObj;
      this.sortDirection = directionParse(arg1);
    } else if (Level.isLevel(primaryObj) || Level.isLevelDescriptor(primaryObj)) {
      this.sortProperty = this.getProperty(primaryObj, `${arg1}`);
      this.sortDirection = directionParse(arg2);
    }

    return this;
  }

  setTime(): this;
  setTime(value: TimeValue): this;
  setTime(value: TimeValue, precision: TimePrecision): this;
  setTime(arg0?: TimeValue | null, arg1?: TimePrecision): this {
    this.timePrecision = arg0 ? arg1 : undefined;
    this.timeValue = arg0 ? arg0 : undefined;
    return this;
  }

  setTop(
    amount: number,
    levelRef: LevelReference,
    calcRef: string | Calculation,
    order: Direction
  ): this {
    if (!isFinite(amount) || isNaN(amount)) {
      throw new TypeError(`Invalid value in argument amount: ${amount}`);
    }
    const cube = this.cube;
    this.topk = {
      amount,
      level: cube.getLevel(levelRef),
      measure: CalculationName[`${calcRef}`] || cube.getMeasure(calcRef),
      order: Direction[order] || Direction.desc
    };
    return this;
  }

  toJSON(): any {
    const cube = this.cube;
    return {
      captions: ifNotEmpty(
        Object.values(this.captions),
        caption => `${caption.level.fullName},${caption.name}`
      ),
      cube: cube.name,
      cuts: ifNotEmpty(
        Object.values(this.cuts),
        cut => `${cut.drillable.fullName},${cut.members}`
      ),
      debug: this.options.debug,
      distinct: this.options.distinct,
      drilldowns: ifNotEmpty(this.drilldowns, item => item.fullName),
      filters: ifNotEmpty(this.filters, filter =>
        ([
          Measure.isMeasure(filter.measure) ? filter.measure.name : filter.measure
        ] as any[])
          .concat(filter.const1, filter.joint, filter.const2)
          .filter(Boolean)
          .join(".")
      ),
      format: this.format,
      growth: ifValid(this.growth, isQueryGrowth, item => ({
        level: item.level.fullName,
        measure: item.measure.name
      })),
      limitAmount: this.limitAmount > 0 ? this.limitAmount : undefined,
      limitOffset: this.limitAmount > 0 ? this.limitOffset : undefined,
      locale: this.locale || undefined,
      measures: ifNotEmpty(this.measures, item => item.name),
      nonempty: this.options.nonempty,
      parents: this.options.parents,
      properties: ifNotEmpty(
        Object.values(this.properties),
        property => `${property.level.fullName},${property.name}`
      ),
      rca: ifValid(this.rca, isQueryRCA, item => ({
        level1: item.level1.fullName,
        level2: item.level2.fullName,
        measure: item.measure.name
      })),
      server: cube.server,
      sortDirection: this.sortDirection,
      sortProperty:
        !this.sortProperty || typeof this.sortProperty === "string"
          ? this.sortProperty
          : Measure.isMeasure(this.sortProperty)
          ? this.sortProperty.name
          : `${this.sortProperty.level.fullName}.${this.sortProperty.name}`,
      sparse: this.options.sparse,
      timePrecision: this.timePrecision,
      timeValue: this.timeValue,
      topk: ifValid(this.topk, isQueryTopk, item => ({
        amount: item.amount,
        level: item.level.fullName,
        measure: Measure.isMeasure(item.measure) ? item.measure.name : item.measure,
        order: item.order
      }))
    };
  }

  toSource(): string {
    return queryToSource(this);
  }

  toString(kind?: string): string {
    if (kind && typeof kind === "string") {
      const { datasource } = this.cube;
      return datasource.stringifyQueryURL(this, kind);
    } else {
      return formUrlEncoded(this.toJSON(), {
        ignorenull: true,
        skipIndex: true,
        sorted: true
      });
    }
  }
}
