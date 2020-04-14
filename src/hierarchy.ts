import Cube from "./cube";
import Dimension from "./dimension";
import { ClientError } from "./errors";
import { AdaptedHierarchy } from "./interfaces";
import Level from "./level";
import { Annotated, FullNamed, Serializable } from "./mixins";
import { applyMixins, nameMapperFactory } from "./utils";

interface Hierarchy extends Annotated, FullNamed, Serializable<AdaptedHierarchy> {}

class Hierarchy {
  private readonly _parent?: Dimension;

  readonly _source: AdaptedHierarchy;
  readonly levels: Level[] = [];
  readonly levelsByName: Readonly<Record<string, Level>> = {};

  static isHierarchy(obj: any): obj is Hierarchy {
    return Boolean(obj && obj._source && obj._source._type === "hierarchy");
  }

  constructor(source: AdaptedHierarchy, parent?: Dimension) {
    this._parent = parent;
    this._source = source;

    const nameMapper = nameMapperFactory(this);

    const [levels, levelsByName] = nameMapper(source.levels, Level);
    this.levels = levels;
    this.levelsByName = levelsByName;
  }

  get cube(): Cube {
    return this.dimension.cube;
  }

  get dimension(): Dimension {
    if (!this._parent) {
      throw new ClientError(
        `Hierarchy ${this} doesn't have an associated parent dimension.`
      );
    }
    return this._parent;
  }

  getLevel(identifier: string | Level): Level {
    const levelName = typeof identifier === "string" ? identifier : identifier.name;
    const level = this.levelsByName[levelName];
    if (!level) {
      throw new ClientError(`Object ${identifier} is not a valid dimension identifier`);
    }
    return level;
  }
}

applyMixins(Hierarchy, [Annotated, FullNamed, Serializable]);

export default Hierarchy;
