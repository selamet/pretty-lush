import { FormatError } from "./errors.js";

// JSON gets its own path (not Prettier) so we can:
//   1. apply an optional JSONPath filter before re-serialising, and
//   2. emit canonical multi-line output (`JSON.stringify` with indent) —
//      Prettier's json parser collapses short objects onto one line.
export async function formatJson(src, opts) {
  const indent =
    opts.indent === "tab" ? "\t" : Math.max(1, Number(opts.indent) || 2);
  try {
    let parsed = JSON.parse(src);
    if (opts.jsonPath && opts.jsonPath.trim()) {
      const { JSONPath } = await import("jsonpath-plus");
      try {
        const result = JSONPath({ path: opts.jsonPath.trim(), json: parsed });
        parsed = result;
      } catch (qe) {
        throw new FormatError(`Invalid JSONPath: ${qe.message || qe}`, {
          hint: "Examples: $.foo, $..name, $.items[*].id",
        });
      }
    }
    return JSON.stringify(parsed, null, indent) + "\n";
  } catch (e) {
    if (e instanceof FormatError) throw e;
    const m = /position\s+(\d+)/i.exec(e.message || "");
    if (m) {
      const pos = Number(m[1]);
      const line = (src.slice(0, pos).match(/\n/g) || []).length + 1;
      const lastNl = src.lastIndexOf("\n", pos - 1);
      const column = pos - (lastNl + 1) + 1;
      throw new FormatError(e.message, {
        line,
        column,
        hint: "Check for trailing commas, single quotes, or missing brackets",
      });
    }
    throw new FormatError(e.message || "Invalid JSON");
  }
}
