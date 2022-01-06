export function abbreviateFullName(parts: string[], joint = "/") {
  const composed = [];

  let n = parts.length;
  while (n--) {
    const token = parts[n];
    if (composed.indexOf(token) === -1) {
      composed.unshift(token);
    }
  }

  return composed.join(joint);
}
