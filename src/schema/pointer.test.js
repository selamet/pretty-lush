import { describe, it, expect } from "vitest";
import {
  escapePointerSegment,
  locatePointer,
  offsetToLineColumn,
  parseJsonPointer,
  pointerRange,
} from "./pointer.js";

// Text of the located value.
const at = (text, p) => {
  const loc = locatePointer(text, p);
  return loc ? text.slice(loc.from, loc.to) : null;
};

describe("parseJsonPointer", () => {
  it("splits and unescapes ~1 and ~0 (in that order)", () => {
    expect(parseJsonPointer("")).toEqual([]);
    expect(parseJsonPointer("/a~1b/~0c/0")).toEqual(["a/b", "~c", "0"]);
    expect(parseJsonPointer("/~01")).toEqual(["~1"]);
    expect(parseJsonPointer("/")).toEqual([""]);
  });

  it("rejects pointers without a leading slash", () => {
    expect(() => parseJsonPointer("a/b")).toThrow(/Invalid JSON pointer/);
  });

  it("escapes segments symmetrically", () => {
    expect(escapePointerSegment("a/b~c")).toBe("a~1b~0c");
    expect(parseJsonPointer("/" + escapePointerSegment("~1/"))).toEqual(["~1/"]);
  });
});

describe("locatePointer", () => {
  const doc = `{
  "user": { "name": "ada", "tags": ["x", {"deep": [1, 2.5e3, null]}] },
  "a/b": true,
  "m~n": false,
  "": 0,
  "esc\\"q": "v\\"w",
  "uni\\u00e9": [ ]
}`;

  it("resolves the whole document", () => {
    expect(at(doc, "")).toBe(doc);
  });

  it("walks nested objects and arrays", () => {
    expect(at(doc, "/user/name")).toBe('"ada"');
    expect(at(doc, "/user/tags/0")).toBe('"x"');
    expect(at(doc, "/user/tags/1/deep/1")).toBe("2.5e3");
    expect(at(doc, "/user/tags/1/deep/2")).toBe("null");
    expect(at(doc, "/user/tags/1")).toBe('{"deep": [1, 2.5e3, null]}');
  });

  it("handles ~1 / ~0 escapes and the empty key", () => {
    expect(at(doc, "/a~1b")).toBe("true");
    expect(at(doc, "/m~0n")).toBe("false");
    expect(at(doc, "/")).toBe("0");
  });

  it("matches keys by their decoded value", () => {
    expect(at(doc, '/esc"q')).toBe('"v\\"w"');
    expect(at(doc, "/unié")).toBe("[ ]");
  });

  it("reports the key range of object members", () => {
    const loc = locatePointer(doc, "/user/name");
    expect(doc.slice(loc.keyFrom, loc.keyTo)).toBe('"name"');
    expect(locatePointer(doc, "/user/tags/0").keyFrom).toBeNull();
  });

  it("returns null for missing members and bad indexes", () => {
    expect(locatePointer(doc, "/nope")).toBeNull();
    expect(locatePointer(doc, "/user/tags/5")).toBeNull();
    expect(locatePointer(doc, "/user/tags/01")).toBeNull();
    expect(locatePointer(doc, "/user/tags/-")).toBeNull();
    expect(locatePointer(doc, "/user/name/x")).toBeNull();
    expect(locatePointer(doc, "/unié/0")).toBeNull();
  });

  it("uses the last duplicate key, like JSON.parse", () => {
    expect(at('{"a": 1, "a": 2}', "/a")).toBe("2");
  });

  it("works on top-level arrays, scalars and a BOM", () => {
    expect(at("[10,20 , 30]", "/2")).toBe("30");
    expect(at("  42  ", "")).toBe("42");
    expect(at('﻿{"k":1}', "/k")).toBe("1");
  });

  it("returns null for malformed or empty text instead of throwing", () => {
    expect(locatePointer("", "")).toBeNull();
    expect(locatePointer('{"a": ', "/a")).toBeNull();
    expect(locatePointer('{"a": "x', "/a")).toBeNull();
    expect(locatePointer(null, "")).toBeNull();
  });

  it("is not fooled by brackets and slashes inside strings", () => {
    const t = '{"s": "}]{[\\"", "t": [ "a]", 7 ]}';
    expect(at(t, "/t/1")).toBe("7");
  });
});

describe("pointerRange", () => {
  const doc = '{\n  "items": [\n    {"id": "x"}\n  ]\n}';

  it("highlights the key of object members", () => {
    const r = pointerRange(doc, "/items/0/id");
    expect(doc.slice(r.from, r.to)).toBe('"id"');
  });

  it("highlights only the opening bracket of keyless containers", () => {
    const r = pointerRange(doc, "/items/0");
    expect(doc.slice(r.from, r.to)).toBe("{");
    expect(pointerRange(doc, "")).toEqual({ from: 0, to: 1 });
  });

  it("highlights the full token of array scalars", () => {
    const r = pointerRange("[1, 22]", "/1");
    expect(r).toEqual({ from: 4, to: 6 });
  });

  it("falls back to the nearest ancestor that resolves", () => {
    const r = pointerRange(doc, "/items/0/missing");
    expect(doc.slice(r.from, r.to)).toBe("{");
  });

  it("returns null when nothing resolves", () => {
    expect(pointerRange("", "/a")).toBeNull();
    expect(pointerRange("{}", "bad")).toBeNull();
  });
});

describe("offsetToLineColumn", () => {
  it("is 1-based", () => {
    expect(offsetToLineColumn("ab\ncd", 0)).toEqual({ line: 1, column: 1 });
    expect(offsetToLineColumn("ab\ncd", 4)).toEqual({ line: 2, column: 2 });
  });
});
