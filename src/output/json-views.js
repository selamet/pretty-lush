// Alternative renderings of formatted JSON output (tree / table).

// Parsed JSON object/array for the tree view, or null if not applicable.
export function toJsonTree(output) {
  if (!output) return null;
  try {
    const parsed = JSON.parse(output);
    return parsed !== null && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

// `{ rows, keys }` when output is a non-empty array of plain objects (keys in
// first-seen order), otherwise null.
export function toJsonTable(output) {
  if (!output) return null;
  try {
    const parsed = JSON.parse(output);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    if (
      !parsed.every((row) => row && typeof row === "object" && !Array.isArray(row))
    )
      return null;
    const keys = [];
    const seen = new Set();
    for (const row of parsed) {
      for (const k of Object.keys(row)) {
        if (!seen.has(k)) {
          seen.add(k);
          keys.push(k);
        }
      }
    }
    return { rows: parsed, keys };
  } catch {
    return null;
  }
}

// The view the user picked, falling back to "code" when it doesn't apply.
export function resolveOutputView(preferred, { tree, table }) {
  if (preferred === "tree" && tree) return "tree";
  if (preferred === "table" && table) return "table";
  return "code";
}
