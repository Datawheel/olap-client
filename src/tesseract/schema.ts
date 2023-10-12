import { Annotations } from "../interfaces/plain";

export interface TesseractEndpointCubes {
  annotations: Annotations;
  cubes: TesseractCube[];
  name: string;
}

export interface TesseractCube {
  alias?: string[];
  annotations: Annotations;
  dimensions: TesseractDimension[];
  measures: TesseractMeasure[];
  min_auth_level: number;
  name: string;
}

export interface TesseractMeasure {
  aggregator: {
    name: "avg" | "count" | "max" | "min" | "sum";
  };
  annotations: Annotations;
  measure_type: TesseractMeasureTypeStd | TesseractMeasureTypeErr;
  name: string;
}

interface TesseractMeasureTypeStd {
  standard: {
    units?: string;
  }
}

interface TesseractMeasureTypeErr {
  error: {
    for_measure?: string;
    err_type?: string;
  }
}

export interface TesseractDimension {
  annotations: Annotations;
  default_hierarchy?: string;
  hierarchies: TesseractHierarchy[];
  name: string;
  type: "geo" | "standard" | "time";
}

export interface TesseractHierarchy {
  annotations: Annotations;
  levels: TesseractLevel[];
  name: string;
}

export interface TesseractLevel {
  annotations: Annotations;
  name: string;
  properties: TesseractProperty[];
  unique_name?: string;
}

export interface TesseractMember {
  ID: number | string;
  Label?: string;
  "EN Label"?: string;
}

export interface TesseractProperty {
  annotations: Annotations;
  caption_set?: string;
  name: string;
  unique_name?: string;
}
