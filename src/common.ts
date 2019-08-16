import {
  Aggregation as TesseractAggregation,
  Client as TesseractClient,
  Cube as TesseractCube,
  Format as TesseractFormat,
  Level as TesseractLevel,
  Member as TesseractMember,
  Query as TesseractQuery
} from "@datawheel/tesseract-client";
import {
  Aggregation as MondrianAggregation,
  Client as MondrianClient,
  Cube as MondrianCube,
  Format as MondrianFormat,
  Level as MondrianLevel,
  Member as MondrianMember,
  Query as MondrianQuery
} from "mondrian-rest-client";

export enum ServerSoftware {
  Mondrian = "mondrian",
  Tesseract = "tesseract"
}

export type Aggregation = TesseractAggregation | MondrianAggregation;
export type Client = TesseractClient | MondrianClient;
export type Cube = TesseractCube | MondrianCube;
export type Format = TesseractFormat | MondrianFormat;
export type Level = TesseractLevel | MondrianLevel;
export type Member = TesseractMember | MondrianMember;
export type Query = TesseractQuery | MondrianQuery;
