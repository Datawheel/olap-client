import type {Cube} from "./cube";
import type {PlainMember} from "./interfaces/plain";
import type {Level} from "./level";
import {FullNamed, Serializable, applyMixins} from "./toolbox/mixins";

export interface Member extends FullNamed, Serializable<PlainMember> {}

export class Member {
  private readonly _parent?: Level;

  readonly _source: PlainMember;
  readonly ancestors: Member[];
  readonly children: Member[];

  constructor(source: PlainMember, parent?: Level) {
    this._parent = parent;
    this._source = source;

    this.ancestors = source.ancestors.map(
      (member: PlainMember) => new Member(member, parent),
    );
    this.children = source.children.map(
      (member: PlainMember) => new Member(member, parent),
    );
  }

  get cube(): Cube {
    return this.level.cube;
  }

  get key(): string | number {
    return this._source.key;
  }

  get level(): Level {
    if (this._parent) {
      return this._parent;
    }
    throw new Error(`Member ${this} doesn't have an associated parent level.`);
  }

  get parentName(): string | undefined {
    return this._source.parentName;
  }
}

applyMixins(Member, [FullNamed, Serializable]);
