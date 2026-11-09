// JSONPath helpers for the JSON tree view.
//
// A node location is a list of segments: numbers are array indices, strings
// are object keys. `buildJsonPath` turns it into a normalized JSONPath
// (RFC 9535 style): `$.a.b[0]`, and `$['weird key']` whenever a key is not a
// plain identifier. `parseJsonPath` reads that same subset back, so paths the
// tree produces can be resolved exactly (see `resolveJsonPath`) instead of
// going through jsonpath-plus, whose parser mishandles keys such as `it's`,
// `a,b`, `@x` or `(x)`.

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function isIdentifier(key) {
  return IDENTIFIER.test(key);
}

function quoteKey(key) {
  let out = "'";
  for (const ch of key) {
    const code = ch.codePointAt(0);
    if (ch === "\\") out += "\\\\";
    else if (ch === "'") out += "\\'";
    else if (ch === "\b") out += "\\b";
    else if (ch === "\f") out += "\\f";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (code < 0x20) out += "\\u" + code.toString(16).padStart(4, "0");
    else out += ch;
  }
  return out + "'";
}

// One path step appended to an existing path string.
export function appendSegment(path, segment) {
  if (typeof segment === "number") return `${path}[${segment}]`;
  return isIdentifier(segment) ? `${path}.${segment}` : `${path}[${quoteKey(segment)}]`;
}

export function buildJsonPath(segments) {
  let path = "$";
  for (const s of segments) path = appendSegment(path, s);
  return path;
}

const ESCAPES = { b: "\b", f: "\f", n: "\n", r: "\r", t: "\t", "/": "/", "\\": "\\", "'": "'", '"': '"' };

// Segments of a normalized, singular JSONPath (`$`, `.name`, `[0]`,
// `['key']`, `["key"]`), or null when the expression uses anything else
// (wildcards, descendants, filters, slices, …).
export function parseJsonPath(input) {
  if (typeof input !== "string") return null;
  const src = input.trim();
  if (src[0] !== "$") return null;
  const segments = [];
  let i = 1;
  while (i < src.length) {
    const ch = src[i];
    if (ch === ".") {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i + 1));
      if (!m) return null;
      segments.push(m[0]);
      i += 1 + m[0].length;
    } else if (ch === "[") {
      const q = src[i + 1];
      if (q === "'" || q === '"') {
        let key = "";
        let j = i + 2;
        for (;;) {
          if (j >= src.length) return null;
          const c = src[j];
          if (c === q) break;
          if (c === "\\") {
            const e = src[j + 1];
            if (e === "u") {
              const hex = src.slice(j + 2, j + 6);
              if (!/^[0-9a-fA-F]{4}$/.test(hex)) return null;
              key += String.fromCharCode(parseInt(hex, 16));
              j += 6;
              continue;
            }
            if (!(e in ESCAPES)) return null;
            key += ESCAPES[e];
            j += 2;
            continue;
          }
          key += c;
          j += 1;
        }
        if (src[j + 1] !== "]") return null;
        segments.push(key);
        i = j + 2;
      } else {
        const m = /^(0|[1-9][0-9]*)\]/.exec(src.slice(i + 1));
        if (!m) return null;
        segments.push(Number(m[1]));
        i += 1 + m[0].length;
      }
    } else {
      return null;
    }
  }
  return segments;
}

const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

// `{ found, value }` for the node at `segments` inside `root`.
export function resolveSegments(root, segments) {
  let cur = root;
  for (const s of segments) {
    if (typeof s === "number") {
      if (!Array.isArray(cur) || s >= cur.length) return { found: false };
      cur = cur[s];
    } else {
      if (cur === null || typeof cur !== "object" || Array.isArray(cur) || !hasOwn(cur, s)) {
        return { found: false };
      }
      cur = cur[s];
    }
  }
  return { found: true, value: cur };
}

// JSON Pointer (RFC 6901) → segments, using `root` to tell array indices from
// object keys. Null when the pointer doesn't address a node of `root`.
export function pointerToSegments(pointer, root) {
  if (pointer === "") return [];
  if (typeof pointer !== "string" || pointer[0] !== "/") return null;
  const segments = [];
  let cur = root;
  for (const raw of pointer.slice(1).split("/")) {
    const tok = raw.replace(/~1/g, "/").replace(/~0/g, "~");
    if (Array.isArray(cur)) {
      if (!/^(0|[1-9][0-9]*)$/.test(tok) || Number(tok) >= cur.length) return null;
      segments.push(Number(tok));
      cur = cur[Number(tok)];
    } else if (cur !== null && typeof cur === "object" && hasOwn(cur, tok)) {
      segments.push(tok);
      cur = cur[tok];
    } else {
      return null;
    }
  }
  return segments;
}

// Path of a tree node in the *unfiltered* document. When the output was
// produced by a JSONPath filter, the tree's root is the array of results and
// `filter.bases[i]` is the location of result `i`; the root itself maps to the
// filter expression. Returns null when the location can't be recovered.
export function absolutePath(segments, filter) {
  if (!filter) return buildJsonPath(segments);
  if (segments.length === 0) return filter.expression;
  const base = filter.bases[segments[0]];
  if (!base) return null;
  return buildJsonPath([...base, ...segments.slice(1)]);
}
