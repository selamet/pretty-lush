// "Generate schema from JSON": a JSON sample → a JSON Schema (2020-12) that
// the sample validates against. Reuses the type inference of "Generate
// types" (../codegen/infer.js), so shapes are merged across array elements
// the same way: keys missing in some elements are not `required`, `null`
// makes a value nullable, ints vs floats become `integer` / `number` and
// ISO date-time strings get `format: "date-time"`.
import { inferType, isOptional } from "../codegen/infer.js";
import { DIALECTS } from "./validate.js";

// TypeSet → schema. Alternatives that are plain `{ type }` collapse into one
// `type` array; anything richer (objects, arrays, formats) uses `anyOf`.
export function typeToSchema(t) {
  const alts = [];
  if (t.object) alts.push(objectSchema(t.object));
  if (t.array) {
    const items = typeToSchema(t.array);
    alts.push(Object.keys(items).length ? { type: "array", items } : { type: "array" });
  }
  if (t.string) alts.push(t.string.dateTime ? { type: "string", format: "date-time" } : { type: "string" });
  if (t.integer) alts.push({ type: "integer" });
  if (t.number) alts.push({ type: "number" });
  if (t.boolean) alts.push({ type: "boolean" });
  if (t.nullable) alts.push({ type: "null" });

  if (alts.length === 0) return {}; // unknown (e.g. items of an always-empty array)
  if (alts.length === 1) return alts[0];
  if (alts.every((a) => Object.keys(a).length === 1)) return { type: alts.map((a) => a.type) };
  // Fold the bare types into a single alternative to keep anyOf short.
  const rich = alts.filter((a) => Object.keys(a).length > 1);
  const bare = alts.filter((a) => Object.keys(a).length === 1).map((a) => a.type);
  if (bare.length) rich.push({ type: bare.length === 1 ? bare[0] : bare });
  return { anyOf: rich };
}

function objectSchema(shape) {
  const out = { type: "object" };
  if (shape.fields.size === 0) return out;
  const properties = {};
  const required = [];
  for (const [key, field] of shape.fields) {
    properties[key] = typeToSchema(field.type);
    if (!isOptional(field, shape)) required.push(key);
  }
  out.properties = properties;
  if (required.length) out.required = required;
  return out;
}

// Parsed JSON value → schema object (with `$schema`).
export function generateSchema(value) {
  return { $schema: DIALECTS["2020-12"].uri, ...typeToSchema(inferType(value)) };
}

// Parsed JSON value → pretty-printed schema text.
export function generateSchemaText(value, indent = 2) {
  const unit = indent === "tab" ? "\t" : Number(indent) || 2;
  return JSON.stringify(generateSchema(value), null, unit) + "\n";
}
