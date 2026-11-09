import { describe, expect, it } from "vitest";
import {
  ancestorPaths,
  collectContainerPaths,
  computeMatches,
  flattenRows,
  splitHighlight,
} from "./json-tree-model.js";

const doc = {
  user: { name: "Ada Lovelace", tags: ["math", "Poetry"] },
  "Display Name": "x",
  count: 42,
  ok: null,
};

describe("flattenRows", () => {
  it("lists visible rows in document order with paths", () => {
    const rows = flattenRows(doc, {});
    expect(rows.map((r) => r.path)).toEqual([
      "$",
      "$.user",
      "$.user.name",
      "$.user.tags",
      "$.user.tags[0]",
      "$.user.tags[1]",
      "$['Display Name']",
      "$.count",
      "$.ok",
    ]);
    expect(rows[4]).toMatchObject({ key: 0, segments: ["user", "tags", 0], depth: 3 });
  });

  it("skips collapsed subtrees", () => {
    const rows = flattenRows(doc, { "$.user": true });
    expect(rows.map((r) => r.path)).toEqual(["$", "$.user", "$['Display Name']", "$.count", "$.ok"]);
    expect(rows[1].open).toBe(false);
  });
});

describe("collectContainerPaths", () => {
  it("collects containers from minDepth down", () => {
    expect(collectContainerPaths(doc)).toEqual({ "$.user": true, "$.user.tags": true });
    expect(collectContainerPaths(doc, 2)).toEqual({ "$.user.tags": true });
    expect(collectContainerPaths(doc, 0)).toHaveProperty("$", true);
  });
});

describe("computeMatches", () => {
  it("is empty for blank queries", () => {
    expect(computeMatches(doc, "  ").list).toEqual([]);
  });

  it("matches keys and values case-insensitively, in document order", () => {
    const m = computeMatches(doc, "NAME");
    expect(m.list.map((x) => [x.path, x.inKey, x.inValue])).toEqual([
      ["$.user.name", true, false],
      ["$['Display Name']", true, false],
    ]);
    expect(m.byPath.get("$['Display Name']")).toBe(1);
    expect([...m.ancestors]).toEqual(["$.user", "$"]);
  });

  it("matches leaf values incl. numbers and null, not array indices", () => {
    expect(computeMatches(doc, "poet").list.map((x) => x.path)).toEqual(["$.user.tags[1]"]);
    expect(computeMatches(doc, "42").list.map((x) => x.path)).toEqual(["$.count"]);
    expect(computeMatches(doc, "nul").list.map((x) => x.path)).toEqual(["$.ok"]);
    expect(computeMatches(["a", "b"], "1").list).toEqual([]);
  });

  it("collects every ancestor of nested matches", () => {
    const m = computeMatches(doc, "math");
    expect(m.list[0].segments).toEqual(["user", "tags", 0]);
    expect(m.ancestors).toEqual(new Set(["$", "$.user", "$.user.tags"]));
  });

  it("handles 5k+ node documents quickly", () => {
    const big = Array.from({ length: 2000 }, (_, i) => ({
      id: i,
      name: `user ${i}`,
      tags: ["alpha", i % 7 === 0 ? "needle" : "beta"],
    }));
    const t0 = performance.now();
    const m = computeMatches(big, "needle");
    const ms = performance.now() - t0;
    expect(m.list).toHaveLength(Math.ceil(2000 / 7));
    expect(ms).toBeLessThan(500);
    // Collapsed: only the root and its 2000 children are flattened.
    const all = collectContainerPaths(big, 1);
    expect(flattenRows(big, all)).toHaveLength(2001);
  });
});

describe("ancestorPaths", () => {
  it("returns the root-first chain of parents", () => {
    expect(ancestorPaths([])).toEqual([]);
    expect(ancestorPaths(["a b", 0, "c"])).toEqual(["$", "$['a b']", "$['a b'][0]"]);
  });
});

describe("splitHighlight", () => {
  it("splits around every occurrence, case-insensitively", () => {
    expect(splitHighlight("Banana", "an")).toEqual([
      { text: "B", match: false },
      { text: "an", match: true },
      { text: "an", match: true },
      { text: "a", match: false },
    ]);
    expect(splitHighlight("abc", "")).toEqual([{ text: "abc", match: false }]);
    expect(splitHighlight("abc", "x")).toEqual([{ text: "abc", match: false }]);
    expect(splitHighlight("ABC", "abc")).toEqual([{ text: "ABC", match: true }]);
  });
});
