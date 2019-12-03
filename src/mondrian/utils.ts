export function joinFullName(nameParts: string[]): string {
  return nameParts.map((token: string) => `[${token}]`).join(".");
}

export function parseCut(cut: string): [string, string[]] {
  if (cut.indexOf("].&[") === -1) {
    throw TypeError(`Couldn't parse cut: ${cut}`);
  }
  cut = `${cut}`.replace(/^\{|\}$/g, "");
  const [drillable] = cut.split(".&", 1);
  const members = cut
    .split(",")
    .map((member: string) => {
      const [, key] = member.split("].&[");
      return key ? key.replace("]", "") : undefined;
    })
    .filter(Boolean) as string[];
  return [drillable, members];
}

export function rangeify(list: number[]) {
  const groups: {[diff: string]: number[]} = {};
  list.sort().forEach((item: number, i: number) => {
    const diff = item - i;
    groups[diff] = groups[diff] || [];
    groups[diff].push(item);
  });
  return Object.values(groups).map(
    group => (group.length > 1 ? [group[0], group[group.length - 1]] : group[0])
  );
}

export function splitFullName(fullname?: string): string[] | undefined {
  return fullname ? `${fullname}`.replace(/^\[|\]$/g, "").split(/\]\.\[?/) : undefined;
}

export function stringifyCut(
  drillable: string,
  members: string[] = []
): string | undefined {
  const cut = members.map((member: string) => `${drillable}.&[${member}]`).join(",");
  return members.length === 0 ? undefined : members.length > 1 ? `{${cut}}` : cut;
}
