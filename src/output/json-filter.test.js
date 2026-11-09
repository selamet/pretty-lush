import { describe, expect, it } from "vitest";
import { applyJsonPath, jsonPathResultBases } from "./json-filter.js";
import { buildJsonPath } from "./json-path.js";

describe("applyJsonPath", () => {
  it("resolves every path the tree copies, even for awkward keys", async () => {
    const keys = ["it's", "a,b", "@x", "(x)", "*", "x]y", "^up", "0", "weird key"];
    const doc = { root: Object.fromEntries(keys.map((k, i) => [k, [{ v: i }]])) };
    for (const [i, k] of keys.entries()) {
      const path = buildJsonPath(["root", k, 0, "v"]);
      expect(await applyJsonPath(doc, path)).toEqual([i]);
    }
  });

  it("returns [] for a missing singular path and the root for $", async () => {
    expect(await applyJsonPath({ a: 1 }, "$.b")).toEqual([]);
    expect(await applyJsonPath({ a: 1 }, "$")).toEqual([{ a: 1 }]);
  });

  it("falls back to jsonpath-plus for other expressions", async () => {
    const doc = { items: [{ id: 1 }, { id: 2 }] };
    expect(await applyJsonPath(doc, "$.items[*].id")).toEqual([1, 2]);
    expect(await applyJsonPath(doc, "$..id")).toEqual([1, 2]);
  });
});

describe("jsonPathResultBases", () => {
  it("locates each result of a wildcard / descendant filter", async () => {
    const doc = { items: [{ id: 1, "n m": { id: 3 } }, { id: 2 }] };
    const bases = await jsonPathResultBases(doc, "$..id");
    const values = await applyJsonPath(doc, "$..id");
    expect(bases).toHaveLength(3);
    expect(bases).toContainEqual(["items", 0, "n m", "id"]);
    // Base i addresses result i.
    for (const [i, base] of bases.entries()) {
      expect(await applyJsonPath(doc, buildJsonPath(base))).toEqual([values[i]]);
    }
  });

  it("returns the parsed path for singular filters", async () => {
    expect(await jsonPathResultBases({ "a b": [5] }, "$['a b'][0]")).toEqual([["a b", 0]]);
    expect(await jsonPathResultBases({ a: 1 }, "$.b")).toEqual([]);
  });
});
