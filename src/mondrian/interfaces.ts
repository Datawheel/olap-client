export enum MondrianFilterOperator {
  eq = "=",
  gt = ">",
  gte = ">=",
  lt = "<",
  lte = "<=",
  neq = "<>"
}

export interface MondrianAggregateURLSearchParams {
  caption: string[];
  cut: string[];
  debug: boolean;
  distinct: boolean;
  drilldown: string[];
  filter: string[];
  limit: number;
  measures: string[];
  nonempty: boolean;
  offset: number;
  order: string;
  order_desc: boolean;
  parents: boolean;
  properties: string[];
  sparse: boolean;
}
