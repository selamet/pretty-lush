import { describe, expect, it } from "vitest";
import {
  absolutePath,
  appendSegment,
  buildJsonPath,
  isIdentifier,
  parseJsonPath,
  pointerToSegments,
  resolveSegments,
} from "./json-path.js";

const WEIRD_KEYS = [
  "weird key",
  "a.b",
  "it's",
  "back\\slash",
  "0",
  "x]y",
  "[z]",
  "$a",
  "@x",
  "~t",
  "^up",
  "a*b",
  "a,b",
  'q"t',
  "a'b.c]d",
  "",
  "ünï",
  "(x)",
  "a?b",
  "*",
  "..",
  "line\nbreak\ttab",
  "ctl\u0001",
  "9lives",
  "kebab-case",
];

describe("buildJsonPath", () => {
  it("uses dot notation for identifiers and [n] for indices", () => {
    expect(buildJsonPath([])).toBe("$");
    expect(buildJsonPath(["a", "b", 0])).toBe("$.a.b[0]");
    expect(buildJsonPath(["items", 12, "_id", "camelCase9"])).toBe("$.items[12]._id.camelCase9");
  });

  it("bracket-quotes keys that are not identifiers", () => {
    expect(buildJsonPath(["weird key"])).toBe("$['weird key']");
    expect(buildJsonPath(["0"])).toBe("$['0']");
    expect(buildJsonPath(["a.b", 1])).toBe("$['a.b'][1]");
    expect(buildJsonPath(["kebab-case"])).toBe("$['kebab-case']");
    expect(buildJsonPath([""])).toBe("$['']");
    expect(buildJsonPath(["$a"])).toBe("$['$a']");
  });

  it("escapes quotes, backslashes and control characters", () => {
    expect(buildJsonPath(["it's"])).toBe("$['it\\'s']");
    expect(buildJsonPath(["back\\slash"])).toBe("$['back\\\\slash']");
    expect(buildJsonPath(['q"t'])).toBe(`$['q"t']`);
    expect(buildJsonPath(["a\nb\tc"])).toBe("$['a\\nb\\tc']");
    expect(buildJsonPath(["x\u0001"])).toBe("$['x\\u0001']");
  });

  it("appendSegment matches buildJsonPath step by step", () => {
    expect(appendSegment(appendSegment("$", "a b"), 3)).toBe(buildJsonPath(["a b", 3]));
  });

  it("isIdentifier", () => {
    expect(isIdentifier("abc_1")).toBe(true);
    expect(isIdentifier("_x")).toBe(true);
    expect(isIdentifier("1x")).toBe(false);
    expect(isIdentifier("a-b")).toBe(false);
    expect(isIdentifier("")).toBe(false);
  });
});

describe("parseJsonPath", () => {
  it("round-trips every key built by buildJsonPath", () => {
    for (const key of WEIRD_KEYS) {
      const segs = ["root", key, 0, key];
      expect(parseJsonPath(buildJsonPath(segs))).toEqual(segs);
    }
  });

  it("accepts double-quoted brackets and surrounding whitespace", () => {
    expect(parseJsonPath(' $["a b"][2].c ')).toEqual(["a b", 2, "c"]);
    expect(parseJsonPath("$['\\u0041\\/']")).toEqual(["A/"]);
  });

  it("returns null for non-singular or invalid expressions", () => {
    for (const p of ["", "a.b", "$.*", "$..name", "$[*]", "$[-1]", "$[01]", "$[0:2]",
      "$[?(@.a)]", "$.a[", "$['a]", "$['a'", "$.", "$ .a", "$['a','b']", "$['\\x']"]) {
      expect(parseJsonPath(p)).toBeNull();
    }
  });
});

describe("resolveSegments", () => {
  const doc = { a: [{ "b c": 1 }, null], "0": "zero" };
  it("finds nodes", () => {
    expect(resolveSegments(doc, [])).toEqual({ found: true, value: doc });
    expect(resolveSegments(doc, ["a", 0, "b c"])).toEqual({ found: true, value: 1 });
    expect(resolveSegments(doc, ["a", 1])).toEqual({ found: true, value: null });
    expect(resolveSegments(doc, ["0"])).toEqual({ found: true, value: "zero" });
  });
  it("misses cleanly", () => {
    expect(resolveSegments(doc, ["x"]).found).toBe(false);
    expect(resolveSegments(doc, ["a", 5]).found).toBe(false);
    expect(resolveSegments(doc, [0]).found).toBe(false);
    expect(resolveSegments(doc, ["a", "0"]).found).toBe(false);
    expect(resolveSegments(doc, ["toString"]).found).toBe(false);
  });
});

describe("pointerToSegments", () => {
  const doc = { a: [{ "x/y": { "~": 1 } }], "": 2 };
  it("converts pointers using the document shape", () => {
    expect(pointerToSegments("", doc)).toEqual([]);
    expect(pointerToSegments("/a/0/x~1y/~0", doc)).toEqual(["a", 0, "x/y", "~"]);
    expect(pointerToSegments("/", doc)).toEqual([""]);
  });
  it("returns null for pointers that miss", () => {
    expect(pointerToSegments("/a/1", doc)).toBeNull();
    expect(pointerToSegments("/nope", doc)).toBeNull();
    expect(pointerToSegments("a", doc)).toBeNull();
  });
});

describe("absolutePath", () => {
  it("is the plain path without a filter", () => {
    expect(absolutePath(["a", 0], null)).toBe("$.a[0]");
  });
  it("rebases onto filter results", () => {
    const filter = { expression: "$..name", bases: [["a", "name"], ["b c", 2, "name"], null] };
    expect(absolutePath([], filter)).toBe("$..name");
    expect(absolutePath([0], filter)).toBe("$.a.name");
    expect(absolutePath([1, "first"], filter)).toBe("$['b c'][2].name.first");
    expect(absolutePath([2], filter)).toBeNull();
    expect(absolutePath([7], filter)).toBeNull();
  });
});
