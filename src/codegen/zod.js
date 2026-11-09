// Zod emitter: one `export const <Name>Schema = z.object({…})` per object
// shape plus its inferred type, declared before any schema that uses it.
// A root that isn't an object becomes `export const RootSchema = z.array(…)`.
// Integers use `z.number().int()`; the output works with Zod 3 and Zod 4.
import { isNamedObject, isOptional, jsKey, members } from "./infer.js";

const DATE_TIME_NOTE = " // ISO 8601 date-time";

export function schemaName(name) {
  return `${name}Schema`;
}

function memberExpr(m, names, t) {
  switch (m.kind) {
    case "object":
      return schemaName(names.get(t.object));
    case "map":
      return "z.record(z.string(), z.unknown())";
    case "array":
      return `z.array(${schemaExpr(m.items, names)})`;
    case "string":
      return "z.string()";
    case "integer":
      return "z.number().int()";
    case "number":
      return "z.number()";
    case "boolean":
      return "z.boolean()";
    default:
      return "z.unknown()";
  }
}

export function schemaExpr(t, names) {
  const parts = members(t).map((m) => memberExpr(m, names, t));
  if (parts.length === 0) return t.nullable ? "z.null()" : "z.unknown()";
  const base = parts.length === 1 ? parts[0] : `z.union([${parts.join(", ")}])`;
  return t.nullable ? `${base}.nullable()` : base;
}

function isDateTimeOnly(t) {
  const ms = members(t);
  return ms.length === 1 && ms[0].kind === "string" && ms[0].dateTime;
}

function emitObject(name, t, names) {
  const lines = [`export const ${schemaName(name)} = z.object({`];
  for (const [key, field] of t.object.fields) {
    const opt = isOptional(field, t.object) ? ".optional()" : "";
    const note = isDateTimeOnly(field.type) ? DATE_TIME_NOTE : "";
    lines.push(`  ${jsKey(key)}: ${schemaExpr(field.type, names)}${opt},${note}`);
  }
  lines.push("});");
  lines.push(`export type ${name} = z.infer<typeof ${schemaName(name)}>;`);
  return lines.join("\n");
}

/** @param {ReturnType<import("./infer.js").buildSchema>} schema */
export function emitZod({ root, rootName, names, declarations }) {
  const blocks = ['import { z } from "zod";'];
  for (const d of declarations) blocks.push(emitObject(d.name, d.type, names));
  if (!isNamedObject(root)) {
    blocks.push(
      `export const ${schemaName(rootName)} = ${schemaExpr(root, names)};\n` +
        `export type ${rootName} = z.infer<typeof ${schemaName(rootName)}>;`
    );
  }
  return blocks.join("\n\n") + "\n";
}
