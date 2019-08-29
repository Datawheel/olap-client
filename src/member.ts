import Cube from "./cube";
import {ClientError} from "./errors";
import {AdaptedMember} from "./interfaces";
import Level from "./level";
import {FullNamed, Serializable} from "./mixins";
import {applyMixins} from "./utils";

interface Member extends FullNamed, Serializable<AdaptedMember> {}

class Member {
  private readonly _parent?: Level;

  readonly _source: AdaptedMember;

  constructor(source: AdaptedMember, parent?: Level) {
    this._parent = parent;
    this._source = source;
  }

  get cube(): Cube {
    return this.level.cube;
  }

  get level(): Level {
    if (!this._parent) {
      throw new ClientError(`Member ${this} doesn't have an associated parent level.`);
    }
    return this._parent;
  }
}

applyMixins(Member, [FullNamed, Serializable]);

export default Member;
