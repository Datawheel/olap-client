export enum TesseractFilterOperator {
  eq = "=",
  gt = ">",
  gte = ">=",
  lt = "<",
  lte = "<=",
  neq = "!=",
}

export interface TesseractAggregateURLSearchParams {
  captions: string[];
  cuts: string[];
  debug: boolean;
  distinct: boolean;
  drilldowns: string[];
  exclude_default_members: boolean;
  filters: string[];
  growth: string;
  limit: string | number;
  measures: string[];
  nonempty: boolean;
  parents: boolean;
  properties: string[];
  rate: string;
  rca: string;
  sort: string;
  sparse: boolean;
  top_where: string;
  top: string;
}

export interface TesseractLogicLayerURLSearchParams {
  cube: string;
  debug: boolean;
  drilldowns: string;
  exclude_default_members: boolean;
  exclude: string;
  filters: string;
  growth: string;
  limit: string;
  locale: string;
  measures: string;
  parents: boolean;
  properties: string;
  rate: string;
  rca: string;
  sort: string;
  sparse: boolean;
  time: string;
  top_where: string;
  top: string;
  [cut: string]: string | boolean; // actually just string, but (ts2411)
}
