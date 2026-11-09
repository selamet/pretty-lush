// Source-literal printers shared by the cURL emitters (JavaScript and
// Python), plus the "is this body JSON?" rule they all follow.
import { getHeader } from "./parse.js";

const JS_IDENT = /^[A-Za-z_$][\w$]*$/;
const PY_INDENT = "    ";
const JS_INDENT = "  ";

const INLINE_MAX = 60;

// JS string literal: double quoted, or single quoted when that avoids
// escaping double quotes (e.g. a raw JSON body).
export function jsString(s) {
  const json = JSON.stringify(s);
  if (!s.includes('"') || s.includes("'")) return json;
  return `'${json.slice(1, -1).replace(/\\(u[0-9a-fA-F]{4}|.)/g, (m, c) => (c === '"' ? '"' : m))}'`;
}

function isPrimitive(v) {
  return v === null || typeof v !== "object";
}

// Short arrays of primitives stay on one line: `["a", "b"]`.
function inlineArray(items, print) {
  if (!items.every(isPrimitive)) return null;
  const text = `[${items.map((v) => print(v)).join(", ")}]`;
  return text.length <= INLINE_MAX ? text : null;
}

export function jsKey(k) {
  return JS_IDENT.test(k) ? k : jsString(k);
}

// Pretty JS literal for a JSON value; `level` is the indent of the line the
// literal starts on.
export function jsLiteral(value, level = 0) {
  const pad = JS_INDENT.repeat(level + 1);
  const end = JS_INDENT.repeat(level);
  if (value === null) return "null";
  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    const inline = inlineArray(value, (v) => jsLiteral(v));
    if (inline) return inline;
    return `[\n${value.map((v) => pad + jsLiteral(v, level + 1)).join(",\n")},\n${end}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (!entries.length) return "{}";
    return `{\n${entries
      .map(([k, v]) => `${pad}${jsKey(k)}: ${jsLiteral(v, level + 1)}`)
      .join(",\n")},\n${end}}`;
  }
  if (typeof value === "string") return jsString(value);
  return String(value);
}

// Python string literal, double quoted (Black style).
export function pyString(s) {
  let out = '"';
  for (const ch of s) {
    const code = ch.codePointAt(0);
    if (ch === "\\") out += "\\\\";
    else if (ch === '"') out += '\\"';
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (code < 0x20 || code === 0x7f) out += "\\x" + code.toString(16).padStart(2, "0");
    else out += ch;
  }
  return out + '"';
}

export function pyLiteral(value, level = 0) {
  const pad = PY_INDENT.repeat(level + 1);
  const end = PY_INDENT.repeat(level);
  if (value === null) return "None";
  if (value === true) return "True";
  if (value === false) return "False";
  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    const inline = inlineArray(value, (v) => pyLiteral(v));
    if (inline) return inline;
    return `[\n${value.map((v) => pad + pyLiteral(v, level + 1) + ",").join("\n")}\n${end}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (!entries.length) return "{}";
    return `{\n${entries
      .map(([k, v]) => `${pad}${pyString(k)}: ${pyLiteral(v, level + 1)},`)
      .join("\n")}\n${end}}`;
  }
  if (typeof value === "string") return pyString(value);
  return String(value);
}

// The parsed JSON body when the request sends JSON (a JSON content type and
// an object / array body), else undefined.
export function jsonBody(req) {
  if (!req.body || req.body.kind !== "raw") return undefined;
  const ct = getHeader(req.headers, "content-type") || "";
  if (!/[/+]json\b/i.test(ct)) return undefined;
  const text = req.body.text.trim();
  if (!text.startsWith("{") && !text.startsWith("[")) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// True when the response is likely JSON (Accept asks for it).
export function expectsJson(req) {
  const accept = getHeader(req.headers, "accept") || "";
  return /[/+]json\b/i.test(accept) && !/\*\/\*/.test(accept.split(",")[0]);
}
