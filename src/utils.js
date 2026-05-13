// Pure text transforms used by the ⌘K palette. Each takes a string
// and returns a string, or throws an Error with a human message.

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
  // preserve trailing empty line slot if input ended with \n
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

export function toUpperCase(src) {
  return src.toUpperCase();
}

export function toLowerCase(src) {
  return src.toLowerCase();
}

export function toTitleCase(src) {
  return src.replace(
    /\b\w[\w']*/g,
    (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()
  );
}

// ── encoding ────────────────────────────────────────
function bytesToB64(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function base64Encode(src) {
  return bytesToB64(new TextEncoder().encode(src));
}

export function base64Decode(src) {
  const cleaned = src.trim().replace(/\s+/g, "");
  // accept both standard and url-safe base64
  const std = cleaned.replace(/-/g, "+").replace(/_/g, "/");
  const padded = std + "=".repeat((4 - (std.length % 4)) % 4);
  try {
    return new TextDecoder().decode(b64ToBytes(padded));
  } catch (e) {
    throw new Error("Input is not valid Base64");
  }
}

export function urlEncode(src) {
  return encodeURIComponent(src);
}

export function urlDecode(src) {
  try {
    return decodeURIComponent(src.trim());
  } catch {
    throw new Error("Input is not valid percent-encoded text");
  }
}

export function hexEncode(src) {
  const bytes = new TextEncoder().encode(src);
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

export function hexDecode(src) {
  const cleaned = src.trim().replace(/^0x/, "").replace(/[\s:]+/g, "");
  if (!/^[0-9a-fA-F]*$/.test(cleaned) || cleaned.length % 2 !== 0)
    throw new Error("Input is not a valid hex string");
  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  }
  return new TextDecoder().decode(bytes);
}

// ── JWT ─────────────────────────────────────────────
function b64uDecodeToString(part) {
  let s = part.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return new TextDecoder().decode(b64ToBytes(s));
}

export function decodeJwt(src) {
  const trimmed = src.trim();
  const parts = trimmed.split(".");
  if (parts.length !== 3)
    throw new Error("JWT must have three dot-separated parts");
  let header;
  let payload;
  try {
    header = JSON.parse(b64uDecodeToString(parts[0]));
  } catch {
    throw new Error("JWT header is not valid base64url JSON");
  }
  try {
    payload = JSON.parse(b64uDecodeToString(parts[1]));
  } catch {
    throw new Error("JWT payload is not valid base64url JSON");
  }
  const now = Math.floor(Date.now() / 1000);
  const exp = typeof payload.exp === "number" ? payload.exp : null;
  const iat = typeof payload.iat === "number" ? payload.iat : null;
  const nbf = typeof payload.nbf === "number" ? payload.nbf : null;
  return {
    header,
    payload,
    signature: parts[2],
    meta: {
      issuedAt: iat ? new Date(iat * 1000) : null,
      notBefore: nbf ? new Date(nbf * 1000) : null,
      expiresAt: exp ? new Date(exp * 1000) : null,
      expired: exp ? exp < now : null,
      lifetimeSec: exp && iat ? exp - iat : null,
    },
  };
}

// ── Python ↔ JSON ───────────────────────────────────
//
// Convert a Python literal (the kind you get from `print(my_dict)` or
// `repr(obj)`) into JSON, and vice versa. This is NOT a full Python parser —
// it walks the literal subset (dicts, lists, tuples, sets, strings, numbers,
// True/False/None) and rewrites it as JSON.
//
// Why not regex: single-quote strings can contain `True`, commas can sit
// inside nested brackets, and `'` vs `"` matters. A tiny tokenizer is the
// only way to be correct without pulling in a parser.

function parsePythonLiteral(src) {
  let i = 0;
  const s = src;

  function skipWs() {
    while (i < s.length) {
      const c = s[i];
      if (c === " " || c === "\t" || c === "\n" || c === "\r") {
        i++;
      } else if (c === "#") {
        while (i < s.length && s[i] !== "\n") i++;
      } else {
        break;
      }
    }
  }

  function fail(msg) {
    const line = (s.slice(0, i).match(/\n/g) || []).length + 1;
    const lastNl = s.lastIndexOf("\n", i - 1);
    const col = i - (lastNl + 1) + 1;
    throw new Error(`${msg} at line ${line}, column ${col}`);
  }

  function parseString() {
    // Optional prefix: r, b, u, rb, br — we accept and strip (b/u become regular strings).
    let raw = false;
    if (/[rbuRBU]/.test(s[i])) {
      let j = i;
      let p1 = s[j++];
      let p2 = s[j];
      if (/[rbuRBU]/.test(p2) && (p1.toLowerCase() + p2.toLowerCase()).match(/^(rb|br)$/)) {
        if (p1.toLowerCase() === "r" || p2.toLowerCase() === "r") raw = true;
        i = j + 1;
      } else if ((p1 === "'" || p1 === '"') === false) {
        if (p1.toLowerCase() === "r") raw = true;
        i = j;
      }
    }
    const quote = s[i];
    if (quote !== "'" && quote !== '"') fail("Expected string literal");
    // Triple-quoted?
    const triple = s.slice(i, i + 3) === quote.repeat(3);
    if (triple) i += 3; else i++;
    let out = "";
    while (i < s.length) {
      if (triple) {
        if (s.slice(i, i + 3) === quote.repeat(3)) {
          i += 3;
          return out;
        }
      } else if (s[i] === quote) {
        i++;
        return out;
      }
      const c = s[i];
      if (c === "\\" && !raw) {
        const n = s[i + 1];
        i += 2;
        switch (n) {
          case "n": out += "\n"; break;
          case "t": out += "\t"; break;
          case "r": out += "\r"; break;
          case "b": out += "\b"; break;
          case "f": out += "\f"; break;
          case "v": out += "\v"; break;
          case "0": out += "\0"; break;
          case "\\": out += "\\"; break;
          case "'": out += "'"; break;
          case '"': out += '"'; break;
          case "\n": break; // line continuation
          case "x": {
            const hex = s.slice(i, i + 2);
            i += 2;
            out += String.fromCharCode(parseInt(hex, 16));
            break;
          }
          case "u": {
            const hex = s.slice(i, i + 4);
            i += 4;
            out += String.fromCharCode(parseInt(hex, 16));
            break;
          }
          default:
            out += n;
        }
      } else {
        out += c;
        i++;
      }
    }
    fail("Unterminated string");
  }

  function parseNumber() {
    const start = i;
    if (s[i] === "+" || s[i] === "-") i++;
    // hex / oct / bin
    if (s[i] === "0" && /[xXoObB]/.test(s[i + 1])) {
      const base = { x: 16, X: 16, o: 8, O: 8, b: 2, B: 2 }[s[i + 1]];
      i += 2;
      const digitStart = i;
      while (i < s.length && /[0-9a-fA-F_]/.test(s[i])) i++;
      const raw = s.slice(digitStart, i).replace(/_/g, "");
      return parseInt(raw, base);
    }
    while (i < s.length && /[0-9_]/.test(s[i])) i++;
    if (s[i] === ".") {
      i++;
      while (i < s.length && /[0-9_]/.test(s[i])) i++;
    }
    if (s[i] === "e" || s[i] === "E") {
      i++;
      if (s[i] === "+" || s[i] === "-") i++;
      while (i < s.length && /[0-9_]/.test(s[i])) i++;
    }
    // Python complex (1j) or numeric suffix — we can't represent in JSON.
    if (s[i] === "j" || s[i] === "J") {
      fail("Complex numbers cannot be converted to JSON");
    }
    const raw = s.slice(start, i).replace(/_/g, "");
    const n = Number(raw);
    if (Number.isNaN(n)) fail(`Invalid number '${raw}'`);
    return n;
  }

  function parseIdentifier() {
    const start = i;
    while (i < s.length && /[A-Za-z0-9_]/.test(s[i])) i++;
    return s.slice(start, i);
  }

  function parseValue() {
    skipWs();
    if (i >= s.length) fail("Unexpected end of input");
    const c = s[i];

    if (c === "{") return parseDictOrSet();
    if (c === "[") return parseList();
    if (c === "(") return parseTuple();
    if (c === "'" || c === '"') return parseString();
    if (/[rbuRBU]/.test(c) && (s[i + 1] === "'" || s[i + 1] === '"' ||
        (/[rbuRBU]/.test(s[i + 1]) && (s[i + 2] === "'" || s[i + 2] === '"')))) {
      return parseString();
    }
    if (/[0-9]/.test(c) || ((c === "+" || c === "-") && /[0-9.]/.test(s[i + 1])) || c === ".") {
      return parseNumber();
    }
    if (/[A-Za-z_]/.test(c)) {
      const id = parseIdentifier();
      switch (id) {
        case "True": return true;
        case "False": return false;
        case "None": return null;
        case "nan": case "NaN": return NaN;
        case "inf": case "Infinity": return Infinity;
        default:
          fail(`Unknown identifier '${id}' (only True/False/None are supported)`);
      }
    }
    fail(`Unexpected character '${c}'`);
  }

  function parseList() {
    i++; // [
    const out = [];
    skipWs();
    if (s[i] === "]") { i++; return out; }
    while (i < s.length) {
      out.push(parseValue());
      skipWs();
      if (s[i] === ",") { i++; skipWs(); if (s[i] === "]") { i++; return out; } continue; }
      if (s[i] === "]") { i++; return out; }
      fail("Expected ',' or ']' in list");
    }
    fail("Unterminated list");
  }

  function parseTuple() {
    i++; // (
    const out = [];
    skipWs();
    if (s[i] === ")") { i++; return out; }
    while (i < s.length) {
      out.push(parseValue());
      skipWs();
      if (s[i] === ",") { i++; skipWs(); if (s[i] === ")") { i++; return out; } continue; }
      if (s[i] === ")") { i++; return out; }
      fail("Expected ',' or ')' in tuple");
    }
    fail("Unterminated tuple");
  }

  function parseDictOrSet() {
    i++; // {
    skipWs();
    if (s[i] === "}") { i++; return {}; }
    // Decide dict vs set by parsing the first key/element and looking for ':'.
    const first = parseValue();
    skipWs();
    if (s[i] === ":") {
      i++;
      const dict = {};
      const val = parseValue();
      dict[String(first)] = val;
      skipWs();
      while (s[i] === ",") {
        i++; skipWs();
        if (s[i] === "}") { i++; return dict; }
        const k = parseValue();
        skipWs();
        if (s[i] !== ":") fail("Expected ':' in dict");
        i++;
        const v = parseValue();
        dict[String(k)] = v;
        skipWs();
      }
      if (s[i] === "}") { i++; return dict; }
      fail("Expected ',' or '}' in dict");
    }
    // Set — JSON has no set type, so we emit an array.
    const out = [first];
    while (s[i] === ",") {
      i++; skipWs();
      if (s[i] === "}") { i++; return out; }
      out.push(parseValue());
      skipWs();
    }
    if (s[i] === "}") { i++; return out; }
    fail("Expected ',' or '}' in set");
  }

  skipWs();
  const value = parseValue();
  skipWs();
  if (i < s.length) {
    // Allow a trailing comma at the top level (Python repr never emits it,
    // but humans do). Anything else is a hard error.
    fail("Unexpected trailing content");
  }
  return value;
}

export function pythonToJson(src, { indent = 2 } = {}) {
  if (!src.trim()) return "";
  const value = parsePythonLiteral(src);
  // Replace NaN/Infinity with null (JSON has no representation).
  const safe = JSON.stringify(value, (_, v) => {
    if (typeof v === "number" && !Number.isFinite(v)) return null;
    return v;
  }, indent);
  return safe + "\n";
}

export function jsonToPython(src, { indent = 4 } = {}) {
  if (!src.trim()) return "";
  let parsed;
  try {
    parsed = JSON.parse(src);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e.message}`);
  }
  return emitPython(parsed, indent) + "\n";
}

function emitPython(v, indent, depth = 0) {
  const pad = " ".repeat(indent * depth);
  const innerPad = " ".repeat(indent * (depth + 1));
  if (v === null) return "None";
  if (v === true) return "True";
  if (v === false) return "False";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return v !== v ? "float('nan')" : (v > 0 ? "float('inf')" : "float('-inf')");
    return String(v);
  }
  if (typeof v === "string") return pythonStringLiteral(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    const parts = v.map((x) => innerPad + emitPython(x, indent, depth + 1));
    return "[\n" + parts.join(",\n") + ",\n" + pad + "]";
  }
  if (typeof v === "object") {
    const keys = Object.keys(v);
    if (keys.length === 0) return "{}";
    const parts = keys.map(
      (k) => innerPad + pythonStringLiteral(k) + ": " + emitPython(v[k], indent, depth + 1)
    );
    return "{\n" + parts.join(",\n") + ",\n" + pad + "}";
  }
  return "None";
}

function pythonStringLiteral(s) {
  // Prefer single quotes (Python convention) unless the string contains one
  // and no double quote — then double quotes avoid an escape.
  const hasSingle = s.includes("'");
  const hasDouble = s.includes('"');
  const quote = hasSingle && !hasDouble ? '"' : "'";
  const escaped = s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(new RegExp(quote, "g"), "\\" + quote);
  return quote + escaped + quote;
}

// ── timestamps ──────────────────────────────────────
export function timestampToIso(src) {
  const t = src.trim();
  if (!/^\d+$/.test(t)) throw new Error("Expected a unix timestamp (integer)");
  const n = Number(t);
  // Heuristic: 10 digits = seconds, 13 = milliseconds, 16 = microseconds
  let ms;
  if (t.length >= 16) ms = Math.floor(n / 1000);
  else if (t.length >= 13) ms = n;
  else ms = n * 1000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) throw new Error("Timestamp out of range");
  return d.toISOString();
}

export function isoToTimestamp(src) {
  const d = new Date(src.trim());
  if (Number.isNaN(d.getTime()))
    throw new Error("Could not parse as an ISO date");
  return String(Math.floor(d.getTime() / 1000));
}
