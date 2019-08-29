import {Annotations} from "../interfaces";

export interface TesseractEndpointCubes {
  annotations: Annotations;
  cubes: TesseractCube[];
  name: string;
}

export interface TesseractCube {
  name: string;
  dimensions: TesseractDimension[];
  measures: TesseractMeasure[];
  annotations: Annotations;
}

export interface TesseractMeasure {
  aggregator: {
    name: "avg" | "count" | "sum";
  };
  annotations: Annotations;
  name: string;
}

export interface TesseractDimension {
  annotations: Annotations;
  hierarchies: TesseractHierarchy[];
  name: string;
  type: "geo" | "standard" | "time";
  default_hierarchy?: string;
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
}

export interface TesseractMember {
  ID: number | string;
  Label?: string;
}

export interface TesseractProperty {
  annotations: Annotations;
  name: string;
}
