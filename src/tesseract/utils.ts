export function joinFullName(nameParts: string[]): string {
  return nameParts.some((token: string) => token.indexOf(".") > -1)
    ? nameParts.map((token: string) => `[${token}]`).join(".")
    : nameParts.join(".");
}

export function splitFullName(fullname?: string): string[] | undefined {
  if (!fullname) return undefined;
  fullname = `${fullname}`.replace(/^\[|\]$/g, "");
  return fullname.indexOf("].[") > -1 ? fullname.split(/\]\.\[?/) : fullname.split(".");
}

export function parseCut(cut: string): [string, string[]] {
  const nameParts = splitFullName(cut) || [];
  const memberList = nameParts.pop() || "";
  const drillable = joinFullName(nameParts);
  const members = memberList.split(",");
  return [drillable, members];
}

export function stringifyCut(
  drillable: string,
  members: string[] = []
): string | undefined {
  const drillableSplit = splitFullName(drillable);
  return drillableSplit && members.length > 0
    ? joinFullName(drillableSplit.concat(members.join(",")))
    : undefined;
}
