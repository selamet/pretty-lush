import { appendSegment } from "./json-path.js";

// Pure model behind components/JsonTree.jsx: flattening the visible rows and
// computing search matches. Nodes are identified by their JSONPath string
// (unique per node), relative to the tree's root.

export function isContainer(v) {
  return v !== null && typeof v === "object";
}

export function containerSize(v) {
  return Array.isArray(v) ? v.length : Object.keys(v).length;
}

// Calls `fn(segment, child)` for every direct child of a container.
function eachChild(v, fn) {
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) fn(i, v[i]);
  } else {
    for (const k of Object.keys(v)) fn(k, v[k]);
  }
}

// `{ [path]: true }` for every container at depth >= minDepth (root = 0).
export function collectContainerPaths(data, minDepth = 1) {
  const out = {};
  const walk = (v, path, depth) => {
    if (!isContainer(v)) return;
    if (depth >= minDepth) out[path] = true;
    eachChild(v, (seg, c) => walk(c, appendSegment(path, seg), depth + 1));
  };
  walk(data, "$", 0);
  return out;
}

// Rows currently visible, in document order. A container is open unless
// `collapsed[path]` is truthy. Only open containers are descended into, so
// collapsed subtrees cost nothing.
export function flattenRows(data, collapsed) {
  const rows = [];
  const walk = (v, key, segments, path, depth) => {
    const container = isContainer(v);
    const open = container && !collapsed[path];
    rows.push({ v, key, segments, path, depth, container, open });
    if (open) {
      eachChild(v, (seg, c) =>
        walk(c, seg, [...segments, seg], appendSegment(path, seg), depth + 1)
      );
    }
  };
  walk(data, null, [], "$", 0);
  return rows;
}

// Text a leaf is searched / displayed by (strings without their quotes).
export function leafText(v) {
  return typeof v === "string" ? v : String(v);
}

const EMPTY_MATCHES = Object.freeze({
  query: "",
  list: [],
  byPath: new Map(),
  ancestors: new Set(),
});

// Case-insensitive search over object keys and leaf values (array indices
// are not matched). Returns:
//   list       matches in document order: { path, segments, inKey, inValue }
//   byPath     path → index into `list`
//   ancestors  paths of every container that has a match below it
export function computeMatches(data, rawQuery) {
  const query = (rawQuery || "").trim().toLowerCase();
  if (!query || !isContainer(data)) return EMPTY_MATCHES;
  const list = [];
  const byPath = new Map();
  const ancestors = new Set();

  // Returns true if the subtree at `v` contains a match.
  const walk = (v, key, segments, path) => {
    const inKey = typeof key === "string" && key.toLowerCase().includes(query);
    const container = isContainer(v);
    const inValue = !container && leafText(v).toLowerCase().includes(query);
    let hit = false;
    if (inKey || inValue) {
      byPath.set(path, list.length);
      list.push({ path, segments, inKey, inValue });
      hit = true;
    }
    if (container) {
      let below = false;
      eachChild(v, (seg, c) => {
        if (walk(c, seg, [...segments, seg], appendSegment(path, seg))) below = true;
      });
      if (below) {
        ancestors.add(path);
        hit = true;
      }
    }
    return hit;
  };
  walk(data, null, [], "$");
  return { query, list, byPath, ancestors };
}

// Paths of every proper ancestor of the node at `segments` (root first).
export function ancestorPaths(segments) {
  const out = [];
  let path = "$";
  for (const seg of segments) {
    out.push(path);
    path = appendSegment(path, seg);
  }
  return out;
}

// Splits `text` into `{ text, match }` parts around every case-insensitive
// occurrence of `query` (already lower-cased). Falls back to a single
// unmatched part when lower-casing changes the text's length.
export function splitHighlight(text, query) {
  if (!query) return [{ text, match: false }];
  const lower = text.toLowerCase();
  if (lower.length !== text.length) return [{ text, match: false }];
  const parts = [];
  let from = 0;
  for (;;) {
    const at = lower.indexOf(query, from);
    if (at === -1) break;
    if (at > from) parts.push({ text: text.slice(from, at), match: false });
    parts.push({ text: text.slice(at, at + query.length), match: true });
    from = at + query.length;
  }
  if (from < text.length) parts.push({ text: text.slice(from), match: false });
  return parts.length ? parts : [{ text, match: false }];
}
