import { AggregatorType, DimensionType } from "./enums";

export interface Annotations {
  [key: string]: string | undefined;
}

export interface IAnnotated {
  readonly annotations: Annotations;
}

export interface IFullNamed extends INamed {
  readonly caption?: string;
  readonly fullName?: string;
}

export interface INamed {
  readonly name: string;
}

export interface ISerializable {
  readonly uri: string;
}

export interface PlainCube extends IAnnotated, INamed, ISerializable {
  readonly _type: "cube";
  readonly caption?: string;
  readonly dimensions: PlainDimension[];
  readonly measures: PlainMeasure[];
  readonly namedsets: PlainNamedSet[];
}

export interface PlainDimension extends IAnnotated, IFullNamed, ISerializable {
  readonly _type: "dimension";
  readonly cube: string;
  readonly defaultHierarchy: string;
  readonly dimensionType: DimensionType;
  readonly hierarchies: PlainHierarchy[];
}

export interface PlainHierarchy extends IAnnotated, IFullNamed, ISerializable {
  readonly _type: "hierarchy";
  readonly cube: string;
  readonly dimension: string;
  readonly levels: PlainLevel[];
}

export interface PlainLevel extends IAnnotated, IFullNamed, ISerializable {
  readonly _type: "level";
  readonly caption: string;
  readonly cube: string;
  readonly depth: number;
  readonly dimension: string;
  readonly hierarchy: string;
  readonly properties: PlainProperty[];
  readonly uniqueName?: string;
}

export interface PlainMeasure extends IAnnotated, IFullNamed, ISerializable {
  readonly _type: "measure";
  readonly aggregatorType: AggregatorType;
  readonly cube: string;
}

export interface PlainMember extends IFullNamed, ISerializable {
  readonly _type: "member";
  readonly ancestors: PlainMember[];
  readonly children: PlainMember[];
  readonly depth?: number;
  readonly key: string | number;
  readonly level: string;
  readonly numChildren?: number;
  readonly parentName?: string;
}

export interface PlainNamedSet extends IAnnotated, INamed, ISerializable {
  readonly _type: "namedset";
  readonly cube: string;
  readonly dimension: string;
  readonly hierarchy: string;
  readonly level: string;
}

export interface PlainProperty extends IAnnotated, INamed, ISerializable {
  readonly _type: "property";
  readonly captionSet?: string;
  readonly uniqueName?: string;
}
