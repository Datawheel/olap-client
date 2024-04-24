import { Annotations } from "../interfaces/plain";

export interface TesseractStatus {
    module: string;
    version: string;
    debug: false | Record<string, string>;
    extras: Record<string, string>;
}

export interface TesseractSchema {
    name: string;
    locales: string[];
    default_locale: string;
    annotations: Annotations;
    cubes: TesseractCube[];
}

export interface TesseractCube {
    name: string;
    caption: string;
    annotations: Annotations;
    dimensions: TesseractDimension[];
    measures: TesseractMeasure[];
}

interface TesseractMeasure {
    name: string;
    caption: string;
    annotations: Annotations;
    aggregator: string;
    attached: TesseractMeasure[];
}

interface TesseractDimension {
    name: string;
    caption: string;
    annotations: Annotations;
    type: "standard" | "time" | "geo";
    hierarchies: TesseractHierarchy[];
    default_hierarchy: string;
}

interface TesseractHierarchy {
    name: string;
    caption: string;
    annotations: Annotations;
    levels: TesseractLevel[];
}

interface TesseractLevel {
    name: string;
    caption: string;
    annotations: Annotations;
    depth: number;
    properties: TesseractProperty[];
}

interface TesseractProperty {
    name: string;
    caption: string;
    annotations: Annotations;
    type: string;
}

export interface TesseractDataRequest {
    cube: string;
    drilldowns: string | string[];
    measures: string | string[];
    locale?: string;
    limit?: string;
    properties?: string | string[];
    sort?: string;
    time?: string;
    exclude?: string | string[];
    include?: string | string[];
    filters?: string | string[];
    parents?: boolean | string;
    ranking?: boolean | string;
}

export interface TesseractDataResponse {
    columns: string[];
    data: string[][];
}
