// TypeScript emitter: one `export interface` per object shape, the root first
// and nested types below it. A root that isn't an object (array, primitive)
// becomes `export type Root = …`.
import { isNamedObject, isOptional, jsKey, members, topDownDeclarations } from "./infer.js";

const DATE_TIME_NOTE = " // ISO 8601 date-time";

function memberExpr(m, names, t) {
  switch (m.kind) {
    case "object":
      return names.get(t.object);
    case "map":
      return "Record<string, unknown>";
    case "array": {
      const inner = typeExpr(m.items, names);
      return /[\s|]/.test(inner) ? `(${inner})[]` : `${inner}[]`;
    }
    case "string":
      return "string";
    case "integer":
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    default:
      return "unknown";
  }
}

export function typeExpr(t, names) {
  const parts = members(t).map((m) => memberExpr(m, names, t));
  if (t.nullable) parts.push("null");
  return parts.length ? parts.join(" | ") : "unknown";
}

function isDateTimeOnly(t) {
  const ms = members(t);
  return ms.length === 1 && ms[0].kind === "string" && ms[0].dateTime;
}

function emitInterface(name, t, names) {
  const lines = [`export interface ${name} {`];
  for (const [key, field] of t.object.fields) {
    const opt = isOptional(field, t.object) ? "?" : "";
    const note = isDateTimeOnly(field.type) ? DATE_TIME_NOTE : "";
    lines.push(`  ${jsKey(key)}${opt}: ${typeExpr(field.type, names)};${note}`);
  }
  lines.push("}");
  return lines.join("\n");
}

/** @param {ReturnType<import("./infer.js").buildSchema>} schema */
export function emitTypeScript(schema) {
  const { root, rootName, names } = schema;
  const blocks = [];
  if (!isNamedObject(root)) {
    blocks.push(`export type ${rootName} = ${typeExpr(root, names)};`);
  }
  // Root first, then each type below the first type that references it.
  for (const d of topDownDeclarations(schema)) {
    blocks.push(emitInterface(d.name, d.type, names));
  }
  return blocks.join("\n\n") + "\n";
}
