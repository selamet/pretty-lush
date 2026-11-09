import { parseJsonPath, pointerToSegments, resolveSegments } from "./json-path.js";

// JSONPath filtering of parsed JSON. Normalized singular paths (the ones the
// tree view copies, e.g. `$['weird key'][0]`) are resolved directly; any other
// expression goes through jsonpath-plus, loaded on demand. Either way the
// result is an array of matched values.
export async function applyJsonPath(json, expression) {
  const segments = parseJsonPath(expression);
  if (segments) {
    const hit = resolveSegments(json, segments);
    return hit.found ? [hit.value] : [];
  }
  const { JSONPath } = await import("jsonpath-plus");
  return JSONPath({ path: expression.trim(), json });
}

// Location (segments) of every result of `expression`, in result order;
// an entry is null when jsonpath-plus returns a result that isn't a node
// (e.g. a property name via `~`).
export async function jsonPathResultBases(json, expression) {
  const segments = parseJsonPath(expression);
  if (segments) return resolveSegments(json, segments).found ? [segments] : [];
  const { JSONPath } = await import("jsonpath-plus");
  const pointers = JSONPath({ path: expression.trim(), json, resultType: "pointer" });
  return pointers.map((p) => pointerToSegments(p, json));
}
