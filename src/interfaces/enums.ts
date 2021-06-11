export enum AggregatorType {
  avg = "AVG",
  AVG = "AVG",
  count = "COUNT",
  COUNT = "COUNT",
  max = "MAX",
  MAX = "MAX",
  min = "MIN",
  MIN = "MIN",
  sum = "SUM",
  SUM = "SUM",
  unknown = "UNKNOWN",
  UNKNOWN = "UNKNOWN",
}

export enum Calculation {
  growth = "growth",
  GROWTH = "growth",
  rate = "rate",
  RATE = "rate",
  rca = "rca",
  RCA = "rca",
  topk = "topk",
  TOPK = "topk",
}

export enum Comparison {
  "!=" = "neq",
  "<" = "lt",
  "<=" = "lte",
  "<>" = "neq",
  "=" = "eq",
  ">" = "gt",
  ">=" = "gte",
  eq = "eq",
  EQ = "eq",
  gt = "gt",
  GT = "gt",
  gte = "gte",
  GTE = "gte",
  lt = "lt",
  LT = "lt",
  lte = "lte",
  LTE = "lte",
  NEQ = "neq",
  neq = "neq",
}

export enum DimensionType {
  geo = "geo",
  Geographic = "geo",
  std = "std",
  Standard = "std",
  time = "time",
  Time = "time",
}

export enum Format {
  csv = "csv",
  json = "json",
  jsonarrays = "jsonarrays",
  jsonrecords = "jsonrecords",
  xls = "xls",
}

export enum Direction {
  asc = "asc",
  ASC = "asc",
  desc = "desc",
  DESC = "desc",
}

export enum TimePrecision {
  day = "day",
  DAY = "day",
  month = "month",
  MONTH = "month",
  quarter = "quarter",
  QUARTER = "quarter",
  time = "time",
  TIME = "time",
  week = "week",
  WEEK = "week",
  year = "year",
  YEAR = "year",
}

export enum TimeValue {
  latest = "latest",
  LATEST = "latest",
  oldest = "oldest",
  OLDEST = "oldest",
}

export type TimeValuePoint = TimeValue | number;
