import { Cube } from "./cube";
import { Dimension } from "./dimension";
import { PlainHierarchy } from "./interfaces/plain";
import { Level, LevelReference } from "./level";
import { childClassMapper } from "./toolbox/collection";
import { Annotated, applyMixins, FullNamed, Serializable } from "./toolbox/mixins";

export interface Hierarchy extends Annotated, FullNamed, Serializable<PlainHierarchy> {}

export class Hierarchy {
  private readonly _parent?: Dimension;

  readonly _source: PlainHierarchy;
  readonly levels: Level[] = [];
  readonly levelsByName: Readonly<Record<string, Level>> = {};

  static isHierarchy(obj: any): obj is Hierarchy {
    return Boolean(obj && obj._source && obj._source._type === "hierarchy");
  }

  constructor(source: PlainHierarchy, parent?: Dimension) {
    this._parent = parent;
    this._source = source;

    const levels = childClassMapper(Level, source.levels, this);
    this.levels = levels[0];
    this.levelsByName = levels[1];
  }

  get cube(): Cube {
    return this.dimension.cube;
  }

  get dimension(): Dimension {
    if (this._parent) {
      return this._parent;
    }
    throw new Error(`Hierarchy ${this} doesn't have an associated parent dimension.`);
  }

  getLevel(ref: LevelReference): Level {
    const levelName =
      Level.isLevel(ref)           ? ref.name :
      Level.isLevelDescriptor(ref) ? ref.level :
      /* else */                     ref;
    const level = this.levelsByName[levelName];
    if (level) {
      return level;
    }
    throw new Error(`Object ${ref} is not a valid level identifier`);
  }
}

applyMixins(Hierarchy, [Annotated, FullNamed, Serializable]);
