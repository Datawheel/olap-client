/**
 * These are objects constructed by the user to use as reference to an object
 * in the Cube schema.
 */

import { Calculation, Comparison, Direction, TimePrecision, TimeValuePoint } from "./enums";

export interface CalculationGrowthDescriptor {
  kind: "growth";
  category: LevelDescriptor;
  value: string;
}

export interface CalculationRCADescriptor {
  kind: "rca";
  location: LevelDescriptor;
  category: LevelDescriptor;
  value: string;
}

export interface CalculationTopkDescriptor {
  kind: "topk";
  amount: number;
  category: LevelDescriptor;
  value: string | Calculation;
  order: string;
}

export type CalculationDescriptor =
  | CalculationGrowthDescriptor
  | CalculationRCADescriptor
  | CalculationTopkDescriptor;

export interface CutDescriptor extends LevelDescriptor {
  members: string[] | number[];
  exclusive?: boolean;
  for_match?: boolean;
}

export interface FilterDescriptor {
  server?: string;
  cube?: string;
  measure: string;
  constraint: [Comparison, number];
  joint?: "and" | "or";
  constraint2?: [Comparison, number];
}

export interface LevelDescriptor {
  server?: string;
  cube?: string;
  dimension?: string;
  hierarchy?: string;
  level: string;
}

export interface PropertyDescriptor {
  server?: string;
  cube?: string;
  dimension?: string;
  hierarchy?: string;
  level?: string;
  property: string;
}

export interface QueryDescriptor {
  server?: string;
  cube?: string;
  calculations: CalculationDescriptor[];
  captions: PropertyDescriptor[];
  cuts: CutDescriptor[];
  drilldowns: LevelDescriptor[];
  filters: FilterDescriptor[];
  format: string;
  locale: string;
  measures: string[];
  options: Record<string, boolean | undefined>;
  page_limit: number;
  page_offset: number;
  properties: PropertyDescriptor[];
  sort_direction: Direction | string | undefined;
  sort_property: PropertyDescriptor | string | undefined;
  time: [TimePrecision | string, TimeValuePoint | string] | undefined;
}
