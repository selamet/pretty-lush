// Tiny shared parsers used by the structural formatters (Dockerfile, dotenv).
// They are string-level utilities — bracket-aware splitting and line
// rewrapping — and intentionally do not depend on any external library.

export const MAX_LINE = 80;

export function splitTopLevelCommas(s) {
  const out = [];
  let depth = 0;
  let inStr = null;
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      cur += c;
      if (c === inStr && s[i - 1] !== "\\") inStr = null;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = c;
      cur += c;
      continue;
    }
    if ("[({".includes(c)) depth++;
    if ("])}".includes(c)) depth--;
    if (c === "," && depth === 0) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  if (cur.trim() !== "" || out.length > 0) out.push(cur);
  return out;
}

export function findMatchingClose(s, openIdx) {
  const openChar = s[openIdx];
  const closeChar = { "[": "]", "(": ")", "{": "}" }[openChar];
  let depth = 0;
  let inStr = null;
  for (let i = openIdx; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === inStr && s[i - 1] !== "\\") inStr = null;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = c;
      continue;
    }
    if (c === openChar) depth++;
    else if (c === closeChar) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}
