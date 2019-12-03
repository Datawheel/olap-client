export enum AggregatorType {
  AVG = "AVG",
  COUNT = "COUNT",
  MAX = "MAX",
  MIN = "MIN",
  SUM = "SUM",
  UNKNOWN = "UNKNOWN"
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
  gt = "gt",
  gte = "gte",
  lt = "lt",
  lte = "lte",
  neq = "neq"
}

export enum DimensionType {
  Geographic = "geo",
  Standard = "std",
  Time = "time"
}

export enum Format {
  csv = "csv",
  json = "json",
  jsonrecords = "jsonrecords",
  xls = "xls"
}

export enum Order {
  asc = "asc",
  desc = "desc"
}
