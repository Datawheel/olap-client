export enum TesseractFilterOperator {
  eq = "=",
  gt = ">",
  gte = ">=",
  lt = "<",
  lte = "<=",
  neq = "!="
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
  drilldowns: string;
  time: string;
  measures: string;
  properties: string;
  filters: string;
  parents: boolean;
  top: string;
  top_where: string;
  sort: string;
  limit: string;
  growth: string;
  rca: string;
  debug: boolean;
  exclude_default_members: boolean;
  locale: string;
  distinct: boolean;
  nonempty: boolean;
  sparse: boolean;
  rate: string;
  [cut: string]: string | boolean; // actually just string, but (ts2411)
}
