export enum AggregatorType {
  AVG = "AVG",
  COUNT = "COUNT",
  MAX = "MAX",
  MIN = "MIN",
  SUM = "SUM",
  UNKNOWN = "UNKNOWN"
}

export enum CalculationName {
  growth = "growth",
  GROWTH = "growth",
  rca = "rca",
  RCA = "rca"
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
  neq = "neq"
}

export enum DimensionType {
  geo = "geo",
  Geographic = "geo",
  std = "std",
  Standard = "std",
  time = "time",
  Time = "time"
}

export enum Format {
  csv = "csv",
  json = "json",
  jsonrecords = "jsonrecords",
  xls = "xls"
}

export enum Direction {
  asc = "asc",
  ASC = "asc",
  desc = "desc",
  DESC = "desc"
}

export enum TimePrecision {
  day = "day",
  DAY = "day",
  month = "month",
  MONTH = "month",
  quarter = "quarter",
  QUARTER = "quarter",
  week = "week",
  WEEK = "week",
  year = "year",
  YEAR = "year"
}

export enum TimeValue {
  latest = "latest",
  LATEST = "latest",
  oldest = "oldest",
  OLDEST = "oldest"
}
