import { describe, expect, it } from "vitest";
import {
  collapseBlankLines,
  dedupeLines,
  reverseLines,
  sortLines,
  trimEachLine,
} from "./lines.js";

describe("sortLines", () => {
  it("sorts case-insensitively by default", () => {
    expect(sortLines("banana\nApple\ncherry")).toBe("Apple\nbanana\ncherry");
  });

  it("supports reverse and case-sensitive ordering", () => {
    expect(sortLines("a\nc\nB", { reverse: true })).toBe("c\nB\na");
    expect(sortLines("b\na\nB", { caseInsensitive: false })).toBe("B\na\nb");
  });

  it("does not sort the trailing newline into a leading blank line", () => {
    expect(sortLines("b\na\n")).toBe("a\nb\n");
  });
});

describe("dedupeLines", () => {
  it("removes repeated lines, keeping first occurrence order", () => {
    expect(dedupeLines("a\nb\na\nc\nb")).toBe("a\nb\nc");
  });

  it("keeps blank lines unless asked otherwise", () => {
    expect(dedupeLines("a\n\na\n\nb")).toBe("a\n\n\nb");
    expect(dedupeLines("a\n\na\n\nb", { keepBlank: false })).toBe("a\n\nb");
  });

  it("preserves a single trailing newline", () => {
    expect(dedupeLines("a\na\n")).toBe("a\n");
  });
});

describe("reverseLines", () => {
  it("reverses line order", () => {
    expect(reverseLines("1\n2\n3")).toBe("3\n2\n1");
  });

  it("preserves a trailing newline and normalises CRLF", () => {
    expect(reverseLines("1\r\n2\r\n")).toBe("2\n1\n");
  });
});

describe("trimEachLine", () => {
  it("strips trailing spaces and tabs only", () => {
    expect(trimEachLine("  a  \n\tb\t\t")).toBe("  a\n\tb");
  });

  it("preserves a single trailing newline", () => {
    expect(trimEachLine("a \n")).toBe("a\n");
  });
});

describe("collapseBlankLines", () => {
  it("squeezes runs of blank lines into one", () => {
    expect(collapseBlankLines("a\n\n\n\nb\n\nc")).toBe("a\n\nb\n\nc");
  });

  it("preserves a single trailing newline and handles empty input", () => {
    expect(collapseBlankLines("a\n")).toBe("a\n");
    expect(collapseBlankLines("")).toBe("");
  });
});
