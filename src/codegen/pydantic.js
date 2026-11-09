// Pydantic v2 emitter: one `class <Name>(BaseModel)` per object shape,
// declared before any model that uses it (Python 3.10+ `X | None` syntax).
// Keys that aren't usable as Python field names get a snake_case name and
// `Field(alias="…")`; ISO date-time strings become `datetime`, integers
// `int`, other numbers `float`. A root that isn't an object becomes a
// `RootModel[...]`.
import { isNamedObject, isOptional, members } from "./infer.js";

const PY_KEYWORDS = new Set([
  "False", "None", "True", "and", "as", "assert", "async", "await", "break",
  "class", "continue", "def", "del", "elif", "else", "except", "finally",
  "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal",
  "not", "or", "pass", "raise", "return", "try", "while", "with", "yield",
]);

// Field names that would shadow BaseModel attributes or this module's
// imports inside a class body.
const RESERVED_FIELDS = new Set([
  "copy", "dict", "json", "schema", "schema_json", "construct", "validate",
  "parse_obj", "parse_raw", "parse_file", "from_orm", "update_forward_refs",
  "model_config", "model_fields", "model_computed_fields",
  "datetime", "Any", "BaseModel", "ConfigDict", "Field", "RootModel",
]);

function isPyIdentifier(s) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(s);
}

function snakeCase(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .join("_")
    .toLowerCase();
}

// JSON key → Python field name. Keys that are already valid, public, non-
// reserved identifiers are kept as-is; everything else is rewritten and the
// original key is kept as the alias.
export function pyFieldName(key, taken = new Set()) {
  let name = key;
  const usable =
    isPyIdentifier(key) && !key.startsWith("_") && !PY_KEYWORDS.has(key) &&
    !RESERVED_FIELDS.has(key) && !taken.has(key);
  if (!usable) {
    name = snakeCase(key) || "field";
    if (/^\d/.test(name)) name = `field_${name}`;
    if (PY_KEYWORDS.has(name) || RESERVED_FIELDS.has(name) || taken.has(name)) name = `${name}_`;
  }
  let unique = name;
  for (let i = 2; taken.has(unique); i++) unique = `${name}${i}`;
  return unique;
}

function memberExpr(m, names, t, imports) {
  switch (m.kind) {
    case "object":
      return names.get(t.object);
    case "map":
      imports.add("Any");
      return "dict[str, Any]";
    case "array":
      return `list[${typeExpr(m.items, names, imports)}]`;
    case "string":
      if (m.dateTime) {
        imports.add("datetime");
        return "datetime";
      }
      return "str";
    case "integer":
      return "int";
    case "number":
      return "float";
    case "boolean":
      return "bool";
    default:
      imports.add("Any");
      return "Any";
  }
}

export function typeExpr(t, names, imports = new Set()) {
  const parts = members(t).map((m) => memberExpr(m, names, t, imports));
  if (parts.length === 0) {
    if (t.nullable) return "None";
    imports.add("Any");
    return "Any";
  }
  if (t.nullable) parts.push("None");
  return parts.join(" | ");
}

function emitModel(name, t, names, imports, classNames) {
  const body = [];
  // Class names are reserved too: `Address: Address` would shadow the type.
  const taken = new Set(classNames);
  let aliased = false;
  for (const [key, field] of t.object.fields) {
    const fieldName = pyFieldName(key, taken);
    taken.add(fieldName);
    let ann = typeExpr(field.type, names, imports);
    const optional = isOptional(field, t.object);
    if (optional && ann !== "Any" && !/\bNone$/.test(ann)) ann += " | None";
    const alias = fieldName !== key;
    let value = "";
    if (alias) {
      aliased = true;
      imports.add("Field");
      value = optional
        ? ` = Field(default=None, alias=${JSON.stringify(key)})`
        : ` = Field(alias=${JSON.stringify(key)})`;
    } else if (optional) {
      value = " = None";
    }
    body.push(`    ${fieldName}: ${ann}${value}`);
  }
  if (aliased) {
    imports.add("ConfigDict");
    body.unshift("    model_config = ConfigDict(populate_by_name=True)", "");
  }
  return [`class ${name}(BaseModel):`, ...body].join("\n");
}

/** @param {ReturnType<import("./infer.js").buildSchema>} schema */
export function emitPydantic({ root, rootName, names, declarations }) {
  const imports = new Set();
  const classNames = new Set([rootName, ...declarations.map((d) => d.name)]);
  const blocks = declarations.map((d) =>
    emitModel(d.name, d.type, names, imports, classNames)
  );
  const pydantic = [];
  if (declarations.length) pydantic.push("BaseModel");
  if (imports.has("ConfigDict")) pydantic.push("ConfigDict");
  if (imports.has("Field")) pydantic.push("Field");
  if (!isNamedObject(root)) {
    pydantic.push("RootModel");
    blocks.push(`class ${rootName}(RootModel[${typeExpr(root, names, imports)}]):\n    pass`);
  }

  const header = [];
  if (imports.has("datetime")) header.push("from datetime import datetime");
  if (imports.has("Any")) header.push("from typing import Any");
  if (header.length) header.push("");
  header.push(`from pydantic import ${pydantic.sort().join(", ")}`);

  return `${header.join("\n")}\n\n\n${blocks.join("\n\n\n")}\n`;
}
