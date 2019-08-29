export enum AggregatorType {
  AVG = "AVG",
  COUNT = "COUNT",
  MAX = "MAX",
  MIN = "MIN",
  SUM = "SUM",
  UNKNOWN = "UNKNOWN"
}

export enum Comparison {
  eq = "=",
  gt = ">",
  gte = ">=",
  lt = "<",
  lte = "<=",
  neq = "<>"
}

export enum DimensionType {
  Geographic = "std",
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
