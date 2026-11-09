// "Generate types": JSON sample → TypeScript interfaces, a Zod schema or
// Pydantic v2 models. Pure and dependency-free: ./infer.js builds a merged,
// named schema and one emitter per target prints it.
import { FormatError } from "../formatters/errors.js";
import { buildSchema } from "./infer.js";
import { emitTypeScript } from "./typescript.js";
import { emitZod } from "./zod.js";
import { emitPydantic } from "./pydantic.js";

export { buildSchema } from "./infer.js";

// `noun` names the output in the ⌘K label, `lang` is the language used to
// highlight the generated code and `filename` is what Download saves it as.
export const TYPEGEN_TARGETS = [
  { id: "typescript", label: "TypeScript", noun: "types", short: "TS", lang: "typescript", filename: "types.ts", emit: emitTypeScript },
  { id: "zod", label: "Zod", noun: "schema", short: "Zod", lang: "typescript", filename: "schema.ts", emit: emitZod },
  { id: "pydantic", label: "Pydantic", noun: "models", short: "Pydantic", lang: "python", filename: "models.py", emit: emitPydantic },
];

export const DEFAULT_ROOT_NAME = "Root";

export function getTypegenTarget(id) {
  return TYPEGEN_TARGETS.find((t) => t.id === id) || TYPEGEN_TARGETS[0];
}

function parseJson(text) {
  if (!text.trim()) throw new FormatError("Input is empty — paste a JSON sample.");
  try {
    return JSON.parse(text);
  } catch (e) {
    const m = /position\s+(\d+)/i.exec(e.message || "");
    let line = null;
    let column = null;
    if (m) {
      const pos = Number(m[1]);
      line = (text.slice(0, pos).match(/\n/g) || []).length + 1;
      column = pos - (text.lastIndexOf("\n", pos - 1) + 1) + 1;
    }
    throw new FormatError(`Invalid JSON: ${String(e.message || e).split("\n")[0]}`, {
      line,
      column,
      hint: "Types are generated from a valid JSON sample",
    });
  }
}

// Generates code for `target` from a parsed JSON value.
export function generateFromValue(target, value, { rootName = DEFAULT_ROOT_NAME } = {}) {
  const schema = buildSchema(value, { rootName: rootName.trim() || DEFAULT_ROOT_NAME });
  return getTypegenTarget(target).emit(schema);
}

// Generates code for `target` from JSON text. Throws FormatError on invalid
// JSON (with line / column when the engine reports a position).
export function generateTypes(target, text, opts) {
  return generateFromValue(target, parseJson(text), opts);
}
