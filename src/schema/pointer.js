// JSON Pointer (RFC 6901) → source location in JSON *text*.
//
// Ajv reports errors as JSON pointers into the parsed value; to underline the
// offending value in the editor (and move the caret there) we need offsets
// into the original text. This walks the text with a small tolerant scanner
// instead of re-serialising, so whitespace, formatting and key
// order of the user's document are preserved. Pure, no dependencies.

// "/a~1b/~0c/0" → ["a/b", "~c", "0"]. "" is the whole document. Throws on a
// non-empty pointer that does not start with "/".
export function parseJsonPointer(pointer) {
  if (pointer === "" || pointer == null) return [];
  if (pointer[0] !== "/") throw new Error(`Invalid JSON pointer: ${pointer}`);
  return pointer
    .slice(1)
    .split("/")
    .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
}

// Inverse of parseJsonPointer for one segment.
export function escapePointerSegment(segment) {
  return String(segment).replace(/~/g, "~0").replace(/\//g, "~1");
}

function isWs(c) {
  return c === 32 || c === 10 || c === 13 || c === 9;
}

function skipWs(text, i) {
  while (i < text.length && isWs(text.charCodeAt(i))) i++;
  return i;
}

// End offset (exclusive) of the string token starting at `i` (a `"`).
function skipString(text, i) {
  i++;
  while (i < text.length) {
    const c = text[i];
    if (c === "\\") i += 2;
    else if (c === '"') return i + 1;
    else i++;
  }
  throw new Error("Unterminated string");
}

// End offset (exclusive) of the value starting at `i`.
function skipValue(text, i) {
  const c = text[i];
  if (c === '"') return skipString(text, i);
  if (c === "{" || c === "[") {
    let depth = 0;
    while (i < text.length) {
      const ch = text[i];
      if (ch === '"') {
        i = skipString(text, i);
        continue;
      }
      if (ch === "{" || ch === "[") depth++;
      else if (ch === "}" || ch === "]") {
        depth--;
        if (depth === 0) return i + 1;
      }
      i++;
    }
    throw new Error("Unterminated container");
  }
  // number / true / false / null: runs until a delimiter
  const start = i;
  while (i < text.length && !/[\s,\]}:]/.test(text[i])) i++;
  if (i === start) throw new Error(`Unexpected character at ${i}`);
  return i;
}

function decodeKey(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return raw.slice(1, -1);
  }
}

// Finds member `key` of the object starting at `i`. Like JSON.parse, the last
// duplicate wins. Returns { from, keyFrom, keyTo } or null.
function findMember(text, i, key) {
  let found = null;
  i = skipWs(text, i + 1);
  if (text[i] === "}") return null;
  while (i < text.length) {
    if (text[i] !== '"') throw new Error(`Expected key at ${i}`);
    const keyFrom = i;
    const keyTo = skipString(text, i);
    i = skipWs(text, keyTo);
    if (text[i] !== ":") throw new Error(`Expected ':' at ${i}`);
    const from = skipWs(text, i + 1);
    if (decodeKey(text.slice(keyFrom, keyTo)) === key) found = { from, keyFrom, keyTo };
    i = skipWs(text, skipValue(text, from));
    if (text[i] === ",") i = skipWs(text, i + 1);
    else break;
  }
  return found;
}

// Finds element `index` of the array starting at `i`; returns its offset.
function findElement(text, i, index) {
  if (!/^(0|[1-9]\d*)$/.test(index)) return null;
  const n = Number(index);
  i = skipWs(text, i + 1);
  if (text[i] === "]") return null;
  for (let k = 0; i < text.length; k++) {
    if (k === n) return i;
    i = skipWs(text, skipValue(text, i));
    if (text[i] === ",") i = skipWs(text, i + 1);
    else break;
  }
  return null;
}

/**
 * Locates the value a JSON pointer refers to inside JSON text.
 *
 * @param {string} text     JSON source
 * @param {string} pointer  RFC 6901 pointer ("" = whole document)
 * @returns {null | { from: number, to: number,
 *   keyFrom: number | null, keyTo: number | null }}
 *   `from`/`to` span the value; `keyFrom`/`keyTo` span its property name
 *   (quotes included) when the value is an object member. null when the
 *   pointer does not resolve or the text is not well-formed enough to walk.
 */
export function locatePointer(text, pointer) {
  if (typeof text !== "string") return null;
  try {
    const segments = parseJsonPointer(pointer);
    let i = skipWs(text, text.charCodeAt(0) === 0xfeff ? 1 : 0);
    if (i >= text.length) return null;
    let keyFrom = null;
    let keyTo = null;
    for (const seg of segments) {
      if (text[i] === "{") {
        const m = findMember(text, i, seg);
        if (!m) return null;
        ({ from: i, keyFrom, keyTo } = m);
      } else if (text[i] === "[") {
        const at = findElement(text, i, seg);
        if (at == null) return null;
        i = at;
        keyFrom = keyTo = null;
      } else {
        return null;
      }
    }
    return { from: i, to: skipValue(text, i), keyFrom, keyTo };
  } catch {
    return null;
  }
}

/**
 * Range to highlight for a pointer, falling back to the nearest ancestor
 * that resolves. Object members highlight their key, other containers only
 * their opening bracket (so a `required` error on a large object doesn't
 * underline the whole document) and scalars their full token.
 *
 * @returns {null | { from: number, to: number }}
 */
export function pointerRange(text, pointer) {
  let segments;
  try {
    segments = parseJsonPointer(pointer);
  } catch {
    return null;
  }
  for (let n = segments.length; n >= 0; n--) {
    const p = segments.slice(0, n).map((s) => "/" + escapePointerSegment(s)).join("");
    const loc = locatePointer(text, p);
    if (!loc) continue;
    if (loc.keyFrom != null) return { from: loc.keyFrom, to: loc.keyTo };
    const c = text[loc.from];
    if (c === "{" || c === "[") return { from: loc.from, to: loc.from + 1 };
    return { from: loc.from, to: loc.to };
  }
  return null;
}

// 0-based offset → 1-based { line, column }.
export function offsetToLineColumn(text, offset) {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: offset - lineStart + 1 };
}
