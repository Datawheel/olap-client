import Cube from "./cube";
import { ClientError } from "./errors";
import { AdaptedMember } from "./interfaces";
import Level from "./level";
import { FullNamed, Serializable } from "./mixins";
import { applyMixins } from "./utils";

interface Member extends FullNamed, Serializable<AdaptedMember> {}

class Member {
  private readonly _parent?: Level;

  readonly _source: AdaptedMember;
  readonly ancestors: Member[];
  readonly children: Member[];

  constructor(source: AdaptedMember, parent?: Level) {
    this._parent = parent;
    this._source = source;

    this.ancestors = source.ancestors.map(
      (member: AdaptedMember) => new Member(member, parent)
    );
    this.children = source.children.map(
      (member: AdaptedMember) => new Member(member, parent)
    );
  }

  get cube(): Cube {
    return this.level.cube;
  }

  get key(): string | number {
    return this._source.key;
  }

  get level(): Level {
    if (!this._parent) {
      throw new ClientError(`Member ${this} doesn't have an associated parent level.`);
    }
    return this._parent;
  }

  get parentName(): string | undefined {
    return this._source.parentName;
  }
}

applyMixins(Member, [FullNamed, Serializable]);

export default Member;
