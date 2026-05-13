// Line-oriented transforms. Each takes a string and returns a string,
// preserving the input's trailing-newline policy.

function splitLines(src) {
  return src.replace(/\r\n?/g, "\n").split("\n");
}

function joinLines(lines, trailing) {
  return lines.join("\n") + (trailing ? "\n" : "");
}

function hasTrailingNl(src) {
  return src.endsWith("\n");
}

export function sortLines(src, { reverse = false, caseInsensitive = true } = {}) {
  const lines = splitLines(src);
  const sorted = [...lines].sort((a, b) => {
    const av = caseInsensitive ? a.toLowerCase() : a;
    const bv = caseInsensitive ? b.toLowerCase() : b;
    if (av < bv) return -1;
    if (av > bv) return 1;
    return 0;
  });
  if (reverse) sorted.reverse();
  return joinLines(sorted, hasTrailingNl(src));
}

export function dedupeLines(src, { keepBlank = true } = {}) {
  const lines = splitLines(src);
  const seen = new Set();
  const out = [];
  for (const l of lines) {
    if (l === "" && keepBlank) {
      out.push(l);
      continue;
    }
    if (!seen.has(l)) {
      seen.add(l);
      out.push(l);
    }
  }
  return joinLines(out, hasTrailingNl(src));
}

export function reverseLines(src) {
  const lines = splitLines(src);
  const trailing = hasTrailingNl(src);
  if (trailing && lines[lines.length - 1] === "") lines.pop();
  lines.reverse();
  return joinLines(lines, trailing);
}

export function trimEachLine(src) {
  return joinLines(
    splitLines(src).map((l) => l.replace(/[ \t]+$/, "")),
    hasTrailingNl(src)
  );
}

export function collapseBlankLines(src) {
  return splitLines(src)
    .reduce((acc, l) => {
      const lastBlank = acc.length > 0 && acc[acc.length - 1] === "";
      if (l === "" && lastBlank) return acc;
      acc.push(l);
      return acc;
    }, [])
    .join("\n") + (hasTrailingNl(src) ? "\n" : "");
}
