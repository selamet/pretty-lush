// RFC 4180 CSV parsing / serialisation and the JSON ↔ CSV mapping used by
// the data converters. Pure and dependency-free.
//
// JSON → CSV: the value must be a non-empty array of objects (or of arrays).
//   The header is the union of all object keys in first-seen order; missing
//   keys and null become empty cells; nested objects/arrays are written as
//   JSON text. Fields containing a comma, quote, CR or LF are quoted and
//   quotes are doubled. Records end with "\n" (editor-friendly); the parser
//   accepts both LF and CRLF.
// CSV → JSON: the first row is the header; every other row becomes an object.
//   Values are inferred conservatively: canonical numbers (no leading zeros,
//   safe integers only) → number, `true`/`false` → boolean, a cell that is
//   valid JSON starting with `{` or `[` → that object/array, `null` → null;
//   everything else (including empty cells) stays a string.
import { ConvertError } from "./errors.js";

// Parses CSV text into an array of rows (arrays of strings). Handles quoted
// fields with embedded commas, quotes ("") and newlines; CRLF or LF endings.
// A trailing newline does not produce an empty last row.
export function parseCsv(text, { delimiter = "," } = {}) {
  const rows = [];
  let row = [];
  let field = "";
  let i = 0;
  let line = 1;
  let quoted = false; // current field started with a quote
  const n = text.length;
  if (text.charCodeAt(0) === 0xfeff) i = 1; // strip BOM

  while (i < n) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        // After a closing quote only a delimiter or line end may follow.
        const next = text[i];
        if (i < n && next !== delimiter && next !== "\n" && next !== "\r") {
          throw new ConvertError(
            `Unexpected character after closing quote on line ${line}`,
            { line }
          );
        }
        continue;
      }
      if (ch === "\n") line++;
      field += ch;
      i++;
      continue;
    }
    if (ch === '"' && field === "") {
      quoted = true;
      i++;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += ch === "\r" && text[i + 1] === "\n" ? 2 : 1;
      line++;
      continue;
    }
    field += ch;
    i++;
  }
  if (quoted) {
    throw new ConvertError("Unterminated quoted field", { line });
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function quoteField(value, delimiter) {
  const s = String(value);
  if (
    s.includes(delimiter) ||
    s.includes('"') ||
    s.includes("\n") ||
    s.includes("\r") ||
    s !== s.trim()
  ) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// Serialises rows (arrays of strings) to CSV text ending with a newline.
export function stringifyCsv(rows, { delimiter = "," } = {}) {
  if (rows.length === 0) return "";
  return (
    rows.map((r) => r.map((f) => quoteField(f, delimiter)).join(delimiter)).join("\n") +
    "\n"
  );
}

function cellText(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function describe(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  return typeof value === "object" ? "an object" : `a ${typeof value}`;
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

// Union of object keys across rows, in first-seen order.
export function unionKeys(rows) {
  const keys = [];
  const seen = new Set();
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }
  }
  return keys;
}

// JSON value → CSV text. Throws ConvertError for anything that is not a
// non-empty array of objects (or of arrays).
export function jsonToCsv(value) {
  if (!Array.isArray(value)) {
    throw new ConvertError(
      `CSV needs an array of objects at the top level, but the input is ${describe(value)}.`,
      { hint: 'Wrap rows in [ … ], e.g. [{"id": 1, "name": "ada"}]' }
    );
  }
  if (value.length === 0) {
    throw new ConvertError("The array is empty — there are no rows to write.");
  }
  if (value.every(isPlainObject)) {
    const keys = unionKeys(value);
    if (keys.length === 0) {
      throw new ConvertError("The objects have no keys — there are no columns to write.");
    }
    const rows = [keys, ...value.map((row) => keys.map((k) => cellText(row[k])))];
    return stringifyCsv(rows);
  }
  if (value.every(Array.isArray)) {
    return stringifyCsv(value.map((r) => r.map(cellText)));
  }
  const bad = value.findIndex((v) => !isPlainObject(v));
  throw new ConvertError(
    `CSV needs every array item to be an object, but item ${bad} is ${describe(value[bad])}.`
  );
}

const NUMBER_RE = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/;

// Conservative type inference for one CSV cell.
export function inferCell(s) {
  if (s === "true") return true;
  if (s === "false") return false;
  if (s === "null") return null;
  if (NUMBER_RE.test(s)) {
    const n = Number(s);
    const isInt = !/[.eE]/.test(s);
    if (Number.isFinite(n) && (!isInt || Number.isSafeInteger(n))) return n;
    return s;
  }
  if (s.startsWith("{") || s.startsWith("[")) {
    try {
      const v = JSON.parse(s);
      if (v !== null && typeof v === "object") return v;
    } catch {
      // not JSON — keep as text
    }
  }
  return s;
}

// CSV text → array of objects keyed by the header row.
export function csvToJson(text, { infer = true } = {}) {
  const rows = parseCsv(text).filter(
    (r) => !(r.length === 1 && r[0] === "")
  );
  if (rows.length === 0) {
    throw new ConvertError("The CSV is empty — expected a header row.");
  }
  const [header, ...body] = rows;
  const seen = new Set();
  for (const h of header) {
    if (seen.has(h)) {
      throw new ConvertError(`Duplicate column name "${h}" in the header row.`, {
        line: 1,
      });
    }
    seen.add(h);
  }
  return body.map((r, idx) => {
    if (r.length > header.length) {
      throw new ConvertError(
        `Record ${idx + 2} has ${r.length} fields but the header has ${header.length}.`
      );
    }
    const obj = {};
    header.forEach((h, j) => {
      const cell = r[j] ?? "";
      obj[h] = infer ? inferCell(cell) : cell;
    });
    return obj;
  });
}
