import { describe, it, expect } from "vitest";
import {
  buildMatchModel,
  captureGroupNames,
  compileRegex,
  friendlyRegexError,
  handleRegexMessage,
  highlightRanges,
  MAX_VALUE_CHARS,
  normalizeFlags,
  parseRegexLiteral,
  replacePreview,
  startedMessage,
  toggleFlag,
} from "./core.js";

describe("flags", () => {
  it("normalizes to canonical order without duplicates or unknown flags", () => {
    expect(normalizeFlags("yigx")).toBe("giy");
    expect(normalizeFlags("ggd")).toBe("dg");
    expect(normalizeFlags(null)).toBe("");
  });

  it("toggles flags and keeps u / v exclusive", () => {
    expect(toggleFlag("g", "i")).toBe("gi");
    expect(toggleFlag("gi", "g")).toBe("i");
    expect(toggleFlag("gu", "v")).toBe("gv");
    expect(toggleFlag("gv", "u")).toBe("gu");
  });
});

describe("parseRegexLiteral", () => {
  it("splits a pasted literal into pattern and flags", () => {
    expect(parseRegexLiteral("/a+b/gi")).toEqual({ pattern: "a+b", flags: "gi" });
    expect(parseRegexLiteral("  /^\\d{3}\\/x$/m \n")).toEqual({ pattern: "^\\d{3}\\/x$", flags: "m" });
    expect(parseRegexLiteral("/a/yg")).toEqual({ pattern: "a", flags: "gy" });
    expect(parseRegexLiteral("/a/")).toEqual({ pattern: "a", flags: "" });
  });

  it("returns null for text that isn't a literal", () => {
    expect(parseRegexLiteral("a+b")).toBeNull();
    expect(parseRegexLiteral("//")).toBeNull();
    expect(parseRegexLiteral("/a/gg")).toBeNull();
    expect(parseRegexLiteral("/a/gx")).toBeNull();
    expect(parseRegexLiteral("/a/ b")).toBeNull();
  });
});

describe("compileRegex", () => {
  it("returns the regex or the engine error without throwing", () => {
    expect(compileRegex("a+", "g").regex).toBeInstanceOf(RegExp);
    expect(compileRegex("(", "").error).toMatch(/Invalid regular expression/);
    expect(compileRegex("a", "gg").error).toMatch(/flag/i);
  });
});

describe("captureGroupNames", () => {
  it("numbers capturing groups and keeps their names", () => {
    expect(captureGroupNames("(a)(?<year>\\d+)(?:x)(b)")).toEqual([null, "year", null]);
  });

  it("skips escapes, classes, lookarounds and nested non-capturing groups", () => {
    expect(captureGroupNames("\\(x\\)[(](?=a)(?!b)(?<=c)(?<!d)((?<n>e))")).toEqual([null, "n"]);
    expect(captureGroupNames("[\\]()](a)")).toEqual([null]);
  });

  it("handles nested classes with the v flag", () => {
    expect(captureGroupNames("[[a(]--[b]](c)", { unicodeSets: true })).toEqual([null]);
  });
});

describe("buildMatchModel", () => {
  it("lists every match with ranges and numbered / named groups", () => {
    const model = buildMatchModel({
      pattern: "(?<k>\\w+)=(\\d+)?",
      flags: "g",
      text: "a=1 b= c=33",
    });
    expect(model.status).toBe("ok");
    expect(model.truncated).toBe(false);
    expect(model.groupNames).toEqual(["k", null]);
    expect(model.matches).toHaveLength(3);
    expect(model.matches[0]).toEqual({
      index: 0,
      start: 0,
      end: 3,
      value: "a=1",
      clipped: false,
      groups: [
        { n: 1, name: "k", start: 0, end: 1, value: "a", clipped: false },
        { n: 2, name: null, start: 2, end: 3, value: "1", clipped: false },
      ],
    });
    // A group that didn't participate.
    expect(model.matches[1].groups[1]).toEqual({
      n: 2,
      name: null,
      start: null,
      end: null,
      value: null,
      clipped: false,
    });
    expect(model.matches[2]).toMatchObject({ start: 7, end: 11, value: "c=33" });
  });

  it("reports only the first match without g", () => {
    const model = buildMatchModel({ pattern: "\\d", flags: "", text: "a1b2" });
    expect(model.matches.map((m) => m.value)).toEqual(["1"]);
  });

  it("respects i, m, s and y", () => {
    expect(buildMatchModel({ pattern: "A", flags: "gi", text: "aA" }).matches).toHaveLength(2);
    expect(buildMatchModel({ pattern: "^x", flags: "gm", text: "x\nx" }).matches).toHaveLength(2);
    expect(buildMatchModel({ pattern: "a.b", flags: "gs", text: "a\nb" }).matches).toHaveLength(1);
    expect(buildMatchModel({ pattern: "a", flags: "gy", text: "aab a" }).matches).toHaveLength(2);
    expect(buildMatchModel({ pattern: "b", flags: "y", text: "ab" }).matches).toHaveLength(0);
  });

  it("handles empty matches without looping", () => {
    const model = buildMatchModel({ pattern: "x*", flags: "g", text: "ab" });
    expect(model.matches.map((m) => [m.start, m.end])).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
    ]);
  });

  it("caps the match count and flags truncation", () => {
    const model = buildMatchModel({ pattern: ".", flags: "g", text: "abcdef", maxMatches: 4 });
    expect(model.matches).toHaveLength(4);
    expect(model.truncated).toBe(true);
    const exact = buildMatchModel({ pattern: ".", flags: "g", text: "abcd", maxMatches: 4 });
    expect(exact.truncated).toBe(false);
  });

  it("clips very long values but keeps their real range", () => {
    const text = "x".repeat(MAX_VALUE_CHARS + 10);
    const [m] = buildMatchModel({ pattern: "(x+)", flags: "g", text }).matches;
    expect(m.end).toBe(text.length);
    expect(m.value).toHaveLength(MAX_VALUE_CHARS);
    expect(m.clipped).toBe(true);
    expect(m.groups[0].clipped).toBe(true);
  });

  it("uses UTF-16 offsets (CodeMirror positions)", () => {
    const [m] = buildMatchModel({ pattern: "b", flags: "gu", text: "😀b" }).matches;
    expect([m.start, m.end]).toEqual([2, 3]);
  });

  it("returns an error model for an invalid pattern", () => {
    const model = buildMatchModel({ pattern: "a(", flags: "g", text: "a" });
    expect(model.status).toBe("error");
    expect(model.error).toMatch(/Invalid regular expression/);
  });

  it("includes the replacement preview when a replacement is given", () => {
    const model = buildMatchModel({
      pattern: "(?<k>\\w+)=(\\d+)",
      flags: "g",
      text: "a=1 b=2",
      replacement: "$2:$<k>",
    });
    expect(model.replaced).toBe("1:a 2:b");
    expect(buildMatchModel({ pattern: "a", text: "a" }).replaced).toBeNull();
  });
});

describe("replacePreview", () => {
  it("supports $1, $<name>, $& and $$ and replaces once without g", () => {
    expect(replacePreview(/(?<w>o)(\w)/g, "foo bob", "[$&|$1|$<w>|$2|$$]")).toBe(
      "f[oo|o|o|o|$] b[ob|o|o|b|$]"
    );
    expect(replacePreview(/o/, "foo", "0")).toBe("f0o");
  });

  it("ignores a stale lastIndex", () => {
    const re = /o/y;
    re.lastIndex = 2;
    expect(replacePreview(re, "oo", "0")).toBe("0o");
  });
});

describe("highlightRanges", () => {
  const model = buildMatchModel({ pattern: "(a)(b)?|x*", flags: "g", text: "ab a" });

  it("alternates match variants and numbers group variants", () => {
    const ranges = highlightRanges(model.matches, 4);
    expect(ranges).toContainEqual({ kind: "match", from: 0, to: 2, variant: 0 });
    expect(ranges).toContainEqual({ kind: "group", from: 0, to: 1, variant: 0 });
    expect(ranges).toContainEqual({ kind: "group", from: 1, to: 2, variant: 1 });
    expect(ranges.find((r) => r.kind === "empty")).toMatchObject({ from: 2, to: 2 });
  });

  it("clamps ranges to the current document length", () => {
    const ranges = highlightRanges(model.matches, 1);
    expect(ranges.every((r) => r.to <= 1)).toBe(true);
  });
});

describe("worker protocol", () => {
  it("acknowledges the start of a run", () => {
    expect(startedMessage({ id: 7 })).toEqual({ id: 7, type: "started" });
  });

  it("answers a request with the match model and timing", () => {
    let t = 100;
    const res = handleRegexMessage(
      { id: 3, pattern: "\\d", flags: "g", text: "a1b2", replacement: "#" },
      () => (t += 5)
    );
    expect(res).toMatchObject({ id: 3, type: "result", status: "ok", replaced: "a#b#", elapsedMs: 5 });
    expect(res.matches).toHaveLength(2);
  });

  it("answers invalid patterns and malformed requests with an error", () => {
    expect(handleRegexMessage({ id: 1, pattern: "[", text: "" })).toMatchObject({
      id: 1,
      type: "result",
      status: "error",
    });
    expect(handleRegexMessage({ id: 2 })).toEqual({
      id: 2,
      type: "result",
      status: "error",
      error: "Malformed regex request",
    });
    expect(handleRegexMessage(null)).toMatchObject({ id: null, status: "error" });
  });
});

describe("friendlyRegexError", () => {
  it("drops the pattern echo from engine messages", () => {
    expect(friendlyRegexError(compileRegex("a: (", "g").error)).toBe("Unterminated group");
    expect(friendlyRegexError("Invalid flags supplied to RegExp constructor 'x'")).toBe(
      "Invalid flags supplied to RegExp constructor 'x'"
    );
    expect(friendlyRegexError(undefined)).toBe("");
  });
});
