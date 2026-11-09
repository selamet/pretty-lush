// Data converters: JSON ↔ YAML ↔ TOML ↔ CSV.
//
// Every conversion goes through a plain JSON value: `parseData(from, text)`
// then `stringifyData(to, value)`. YAML (`yaml`) and TOML (`smol-toml`) are
// loaded with dynamic import() so they stay out of the main chunk (they are
// emitted as `fmt-*` chunks, see vite.config.js); CSV is a small built-in
// module (./csv.js).
import { ConvertError } from "./errors.js";
import { csvToJson, jsonToCsv } from "./csv.js";

export { ConvertError } from "./errors.js";

export const DATA_FORMATS = ["json", "yaml", "toml", "csv"];

export const FORMAT_LABELS = { json: "JSON", yaml: "YAML", toml: "TOML", csv: "CSV" };

// Every supported direction, in palette / menu order.
export const CONVERSIONS = [
  ["json", "yaml"],
  ["yaml", "json"],
  ["json", "toml"],
  ["toml", "json"],
  ["json", "csv"],
  ["csv", "json"],
  ["yaml", "toml"],
  ["toml", "yaml"],
  ["yaml", "csv"],
  ["csv", "yaml"],
  ["toml", "csv"],
  ["csv", "toml"],
].map(([from, to]) => ({
  id: `convert-${from}-${to}`,
  from,
  to,
  label: `${FORMAT_LABELS[from]} → ${FORMAT_LABELS[to]}`,
}));

export function isDataFormat(lang) {
  return DATA_FORMATS.includes(lang);
}

// Conversions available when the current language is `lang`.
export function conversionsFrom(lang) {
  return CONVERSIONS.filter((c) => c.from === lang);
}

function firstLine(msg) {
  return String(msg || "").split("\n")[0].trim();
}

function jsonIndent(indent) {
  if (indent === "tab") return "\t";
  return Number(indent) || 2;
}

// Dates (TOML datetimes) and other non-JSON values become their JSON form,
// so every target sees the same plain data.
function toPlain(value) {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

// Text in `format` → plain JSON value. Throws ConvertError on invalid input.
export async function parseData(format, text) {
  if (!text.trim()) throw new ConvertError("Input is empty — nothing to convert.");
  switch (format) {
    case "json":
      try {
        return JSON.parse(text);
      } catch (e) {
        throw new ConvertError(`Invalid JSON: ${firstLine(e.message)}`);
      }
    case "yaml": {
      const YAML = await import("yaml");
      try {
        return toPlain(YAML.parse(text));
      } catch (e) {
        const pos = e.linePos?.[0];
        throw new ConvertError(`Invalid YAML: ${firstLine(e.message)}`, {
          line: pos?.line ?? null,
          column: pos?.col ?? null,
        });
      }
    }
    case "toml": {
      const TOML = await import("smol-toml");
      try {
        return toPlain(TOML.parse(text));
      } catch (e) {
        throw new ConvertError(
          `Invalid TOML: ${firstLine(e.message).replace(/^Invalid TOML document:\s*/, "")}`,
          { line: e.line ?? null, column: e.column ?? null }
        );
      }
    }
    case "csv":
      return csvToJson(text);
    default:
      throw new ConvertError(`Unsupported source format "${format}".`);
  }
}

// Path of the first null in `value` (TOML has no null), or null if none.
function findNull(value, path = "") {
  if (value === null) return path || "(root)";
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const p = findNull(value[i], `${path}[${i}]`);
      if (p) return p;
    }
  } else if (typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      const p = findNull(v, path ? `${path}.${k}` : k);
      if (p) return p;
    }
  }
  return null;
}

// Plain JSON value → text in `format`.
export async function stringifyData(format, value, { indent = 2 } = {}) {
  switch (format) {
    case "json":
      return JSON.stringify(value, null, jsonIndent(indent)) + "\n";
    case "yaml": {
      const YAML = await import("yaml");
      const n = indent === "tab" ? 2 : Number(indent) || 2;
      return YAML.stringify(value, { indent: n, lineWidth: 0 });
    }
    case "toml": {
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new ConvertError(
          "TOML needs a table (object) at the top level.",
          { hint: Array.isArray(value) ? 'Wrap the array in a key, e.g. {"items": [ … ]}' : null }
        );
      }
      const nullAt = findNull(value);
      if (nullAt) {
        throw new ConvertError(`TOML has no null value — found null at "${nullAt}".`, {
          hint: "Remove the key or replace null with a value.",
        });
      }
      const TOML = await import("smol-toml");
      try {
        const out = TOML.stringify(value);
        return out.endsWith("\n") ? out : out + "\n";
      } catch (e) {
        throw new ConvertError(`Can't write TOML: ${firstLine(e.message)}`);
      }
    }
    case "csv":
      return jsonToCsv(value);
    default:
      throw new ConvertError(`Unsupported target format "${format}".`);
  }
}

// Converts `text` from one data format to another.
export async function convertData(from, to, text, opts = {}) {
  const value = await parseData(from, text);
  return stringifyData(to, value, opts);
}
