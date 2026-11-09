// JSON Schema validation of the JSON input. Ajv (+ ajv-formats) is loaded
// on first use with a dynamic import and lands in its own `fmt-ajv` chunk
// (see vite.config.js), so it never weighs on the main bundle or precache.
//
// The dialect follows the schema's `$schema`: draft-07 or 2020-12 (default
// when `$schema` is absent). Everything except the Ajv calls is pure and
// unit-tested in ./validate.test.js.
import { offsetToLineColumn, pointerRange } from "./pointer.js";

export const DIALECTS = {
  "2020-12": { id: "2020-12", label: "2020-12", uri: "https://json-schema.org/draft/2020-12/schema" },
  "draft-07": { id: "draft-07", label: "draft-07", uri: "http://json-schema.org/draft-07/schema#" },
};

export const DEFAULT_DIALECT = "2020-12";

export class SchemaError extends Error {
  constructor(message, { line = null, column = null, hint = null } = {}) {
    super(message);
    this.name = "SchemaError";
    this.line = line;
    this.column = column;
    this.hint = hint;
  }
}

// Parses JSON text, mapping engine errors to a message with line / column.
// Throws SchemaError.
export function parseJsonText(text, what = "JSON") {
  try {
    return JSON.parse(text);
  } catch (e) {
    const raw = String(e?.message || e).split("\n")[0];
    const m = /position\s+(\d+)/i.exec(raw);
    const loc = m ? offsetToLineColumn(text, Number(m[1])) : { line: null, column: null };
    throw new SchemaError(`${what} is not valid JSON: ${raw}`, loc);
  }
}

/**
 * Picks the Ajv dialect for a schema from its `$schema` keyword.
 * @returns {"2020-12" | "draft-07"}
 * @throws {SchemaError} for other drafts.
 */
export function detectDialect(schema) {
  const uri = schema && typeof schema === "object" ? schema.$schema : undefined;
  if (uri === undefined) return DEFAULT_DIALECT;
  if (typeof uri !== "string") throw new SchemaError("`$schema` must be a string URI");
  if (/draft-07\/schema/.test(uri)) return "draft-07";
  if (/draft\/2020-12\/schema/.test(uri)) return "2020-12";
  throw new SchemaError(`Unsupported $schema: ${uri}`, {
    hint: "Use draft-07 or 2020-12 (or omit $schema for 2020-12)",
  });
}

function truncate(s, n = 80) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

// Ajv's message plus the detail that is otherwise only in `params`.
export function describeError(err) {
  const msg = err.message || `fails "${err.keyword}"`;
  const p = err.params || {};
  if (err.keyword === "additionalProperties" && p.additionalProperty != null) {
    return `must NOT have additional property "${p.additionalProperty}"`;
  }
  if (err.keyword === "unevaluatedProperties" && p.unevaluatedProperty != null) {
    return `must NOT have unevaluated property "${p.unevaluatedProperty}"`;
  }
  if (err.keyword === "enum" && Array.isArray(p.allowedValues)) {
    return truncate(`${msg}: ${p.allowedValues.map((v) => JSON.stringify(v)).join(", ")}`);
  }
  return msg;
}

// Pointer that best locates an error in the instance: for unknown-property
// errors that is the property itself, not its parent object.
function errorPointer(err) {
  const p = err.params || {};
  const extra =
    err.keyword === "additionalProperties" ? p.additionalProperty
    : err.keyword === "unevaluatedProperties" ? p.unevaluatedProperty
    : undefined;
  if (extra == null) return err.instancePath || "";
  const seg = String(extra).replace(/~/g, "~0").replace(/\//g, "~1");
  return `${err.instancePath || ""}/${seg}`;
}

/**
 * Ajv errors → list items with source positions in `text`.
 * @returns {Array<{ instancePath: string, keyword: string, message: string,
 *   schemaPath: string, from: number, to: number, line: number, column: number }>}
 *   sorted by position (stable for equal positions).
 */
export function mapAjvErrors(errors, text) {
  return (errors || [])
    .map((err, i) => {
      const range = pointerRange(text, errorPointer(err)) || { from: 0, to: 0 };
      const { line, column } = offsetToLineColumn(text, range.from);
      return {
        instancePath: err.instancePath || "",
        keyword: err.keyword,
        message: describeError(err),
        schemaPath: err.schemaPath || "",
        from: range.from,
        to: range.to,
        line,
        column,
        i,
      };
    })
    .sort((a, b) => a.from - b.from || a.i - b.i)
    .map(({ i: _i, ...rest }) => rest);
}

// ── Ajv (lazy) ───────────────────────────────────────────

let ajvModules = null;

function interop(mod) {
  // CJS packages: the class / plugin may sit on `default` once or twice.
  let m = mod;
  while (m && typeof m !== "function" && m.default) m = m.default;
  return m;
}

async function loadAjv() {
  if (!ajvModules) {
    ajvModules = Promise.all([
      import("ajv"),
      import("ajv/dist/2020"),
      import("ajv-formats"),
    ]).then(([draft07, v2020, formats]) => ({
      "draft-07": interop(draft07),
      "2020-12": interop(v2020),
      addFormats: interop(formats),
    }));
    ajvModules.catch(() => {
      ajvModules = null;
    });
  }
  return ajvModules;
}

// Last compiled schema: validation re-runs on every input edit while the
// schema usually stays the same. A fresh Ajv instance per schema keeps `$id`s
// from colliding between edits.
let compiled = null;

async function compile(schemaText) {
  if (compiled?.text === schemaText) return compiled;
  const schema = parseJsonText(schemaText, "Schema");
  if (typeof schema !== "boolean" && (schema === null || typeof schema !== "object" || Array.isArray(schema))) {
    throw new SchemaError("Schema must be a JSON object (or a boolean)");
  }
  const dialect = detectDialect(schema);
  const mods = await loadAjv();
  const AjvClass = mods[dialect];
  const ajv = new AjvClass({ allErrors: true, strict: false });
  mods.addFormats(ajv);
  let validate;
  try {
    validate = ajv.compile(schema);
  } catch (e) {
    throw new SchemaError(`Invalid schema: ${String(e?.message || e).split("\n")[0]}`, {
      hint: e?.missingRef ? "Remote $ref targets are not fetched — inline them under $defs" : null,
    });
  }
  compiled = { text: schemaText, dialect, validate };
  return compiled;
}

/**
 * Validates JSON text against JSON Schema text.
 *
 * @returns {Promise<
 *   | { status: "valid", dialect: string }
 *   | { status: "invalid", dialect: string, errors: ReturnType<typeof mapAjvErrors> }
 *   | { status: "schema-error", error: { message, line, column, hint } }
 *   | { status: "input-error", error: { message, line, column, hint } }>}
 */
export async function validateJson(inputText, schemaText) {
  let entry;
  try {
    entry = await compile(schemaText);
  } catch (e) {
    return { status: "schema-error", error: toPlainError(e) };
  }
  let value;
  try {
    value = parseJsonText(inputText, "Input");
  } catch (e) {
    return { status: "input-error", error: toPlainError(e) };
  }
  const ok = entry.validate(value);
  if (ok) return { status: "valid", dialect: entry.dialect };
  return {
    status: "invalid",
    dialect: entry.dialect,
    errors: mapAjvErrors(entry.validate.errors, inputText),
  };
}

function toPlainError(e) {
  return {
    message: String(e?.message || e),
    line: e?.line ?? null,
    column: e?.column ?? null,
    hint: e?.hint ?? null,
  };
}
