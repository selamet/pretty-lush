import { describe, it, expect } from "vitest";
import { resolveOutputView, toJsonTable, toJsonTree } from "./json-views.js";
import { outputFilename } from "./filename.js";

describe("toJsonTree", () => {
  it("returns objects and arrays only", () => {
    expect(toJsonTree('{"a":1}')).toEqual({ a: 1 });
    expect(toJsonTree("[1,2]")).toEqual([1, 2]);
    expect(toJsonTree("1")).toBeNull();
    expect(toJsonTree("null")).toBeNull();
    expect(toJsonTree("")).toBeNull();
    expect(toJsonTree("{bad")).toBeNull();
  });
});

describe("toJsonTable", () => {
  it("collects keys in first-seen order", () => {
    expect(toJsonTable('[{"a":1,"b":2},{"c":3,"a":4}]')).toEqual({
      rows: [{ a: 1, b: 2 }, { c: 3, a: 4 }],
      keys: ["a", "b", "c"],
    });
  });

  it("rejects anything that is not a non-empty array of objects", () => {
    expect(toJsonTable("[]")).toBeNull();
    expect(toJsonTable('{"a":1}')).toBeNull();
    expect(toJsonTable('[{"a":1}, 2]')).toBeNull();
    expect(toJsonTable("[[1]]")).toBeNull();
    expect(toJsonTable("[null]")).toBeNull();
    expect(toJsonTable("")).toBeNull();
  });
});

describe("resolveOutputView", () => {
  it("honours the preference only when the view is available", () => {
    expect(resolveOutputView("tree", { tree: {}, table: null })).toBe("tree");
    expect(resolveOutputView("tree", { tree: null, table: {} })).toBe("code");
    expect(resolveOutputView("table", { tree: {}, table: {} })).toBe("table");
    expect(resolveOutputView("table", { tree: {}, table: null })).toBe("code");
    expect(resolveOutputView("code", { tree: {}, table: {} })).toBe("code");
  });
});

describe("outputFilename", () => {
  it("uses the language extension when there is one", () => {
    expect(outputFilename({ ext: "py" })).toBe("formatted.py");
    expect(outputFilename({ ext: "" })).toBe("formatted");
    expect(outputFilename(undefined)).toBe("formatted");
  });
});
