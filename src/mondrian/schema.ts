import type {Annotations} from "../interfaces/plain";

export interface MondrianEndpointCubes {
  cubes: MondrianCube[];
}

export interface MondrianCube {
  annotations: Annotations;
  dimensions: MondrianDimension[];
  measures: MondrianMeasure[];
  name: string;
  named_sets: MondrianNamedSet[];
}

export interface MondrianMeasure {
  aggregator: "AVG" | "COUNT" | "SUM";
  annotations: Annotations;
  caption: string;
  full_name: string;
  name: string;
}

export interface MondrianDimension {
  annotations: Annotations;
  caption: string;
  hierarchies: MondrianHierarchy[];
  name: string;
  type: "standard" | "time";
}

export interface MondrianHierarchy {
  all_member_name: string;
  has_all: boolean;
  levels: MondrianLevel[];
  name: string;
}

export interface MondrianLevel {
  annotations: Annotations;
  caption: string;
  depth: number;
  full_name: string;
  name: string;
  properties: string[];
}

export interface MondrianMember {
  "all_member?": boolean; // false
  ancestors: MondrianMember[];
  caption: string; // "Animal production"
  children: MondrianMember[];
  depth: number; // 3
  "drillable?": boolean; // true
  full_name: string; // "[ISICrev4].[Agriculture, forestry and fishing].[Crop and animal production, hunting and related service activities].[Animal production]"
  key: string | number; // "014"
  level_name: string; // "Level 3"
  name: string; // "Animal production"
  num_children: number; // 7
  parent_name: string; // "[ISICrev4].[Agriculture, forestry and fishing].[Crop and animal production, hunting and related service activities]"
}

export interface MondrianNamedSet {
  annotations: Annotations;
  dimension: string;
  hierarchy: string;
  level: string;
  name: string;
}

export type MondrianProperty = string;
