import { describe, it, expect } from "vitest";
import {
  countDiagnostics,
  isSyntaxCode,
  lineStarts,
  locationToOffset,
  mapRuffDiagnostics,
} from "./ruff-diagnostics.js";

const loc = (row, column) => ({ row, column });

describe("lineStarts / locationToOffset", () => {
  it("indexes line starts", () => {
    expect(lineStarts("")).toEqual([0]);
    expect(lineStarts("ab\ncd\n")).toEqual([0, 3, 6]);
  });

  it("converts 1-based row/column to offsets", () => {
    const text = "import os\nx = 1\n";
    const starts = lineStarts(text);
    expect(locationToOffset(starts, text.length, loc(1, 8))).toBe(7);
    expect(locationToOffset(starts, text.length, loc(2, 1))).toBe(10);
  });

  it("clamps out-of-range locations", () => {
    const text = "ab\ncd";
    const starts = lineStarts(text);
    // past the end of a line → end of that line (before the newline)
    expect(locationToOffset(starts, text.length, loc(1, 99))).toBe(2);
    // past the last line → end of document
    expect(locationToOffset(starts, text.length, loc(9, 1))).toBe(text.length);
    // garbage → start of document
    expect(locationToOffset(starts, text.length, undefined)).toBe(0);
    expect(locationToOffset(starts, text.length, loc(0, -3))).toBe(0);
  });
});

describe("mapRuffDiagnostics", () => {
  // Shape captured from @astral-sh/ruff-wasm-web 0.15 `Workspace.check`.
  const text = "import os\nx = 'é' ; y = undefined_name\n";
  const raw = [
    {
      code: "E702",
      message: "Multiple statements on one line (semicolon)",
      start_location: loc(2, 9),
      end_location: loc(2, 10),
    },
    {
      code: "F401",
      message: "`os` imported but unused",
      start_location: loc(1, 8),
      end_location: loc(1, 10),
      fix: { message: "Remove unused import: `os`", edits: [] },
    },
  ];

  it("maps to CodeMirror diagnostics sorted by position", () => {
    expect(mapRuffDiagnostics(raw, text)).toEqual([
      {
        from: 7,
        to: 9,
        severity: "warning",
        message: "`os` imported but unused",
        source: "Ruff F401",
        code: "F401",
        line: 1,
        column: 8,
        fixable: true,
      },
      {
        from: 18,
        to: 19,
        severity: "warning",
        message: "Multiple statements on one line (semicolon)",
        source: "Ruff E702",
        code: "E702",
        line: 2,
        column: 9,
        fixable: false,
      },
    ]);
    // UTF-16 columns line up with JS string offsets, even after "é".
    expect(text.slice(18, 19)).toBe(";");
  });

  it("marks syntax errors as errors", () => {
    const [a, b, c] = mapRuffDiagnostics(
      [
        { code: "invalid-syntax", message: "Expected `)`", start_location: loc(1, 8), end_location: loc(2, 1) },
        { code: null, message: "legacy", start_location: loc(1, 1), end_location: loc(1, 1) },
        { code: "E999", message: "old style", start_location: loc(1, 2), end_location: loc(1, 3) },
      ],
      "def f(:\n  pass\n"
    );
    expect(a).toMatchObject({ code: "syntax", severity: "error", from: 0, to: 0 });
    expect(b).toMatchObject({ code: "E999", severity: "error" });
    expect(c).toMatchObject({ code: "syntax", severity: "error", from: 7, to: 8 });
    expect(isSyntaxCode("F401")).toBe(false);
  });

  it("never produces inverted or out-of-bounds ranges", () => {
    const [d] = mapRuffDiagnostics(
      [{ code: "W292", message: "x", start_location: loc(5, 4), end_location: loc(1, 1) }],
      "a\nb"
    );
    expect(d.from).toBe(3);
    expect(d.to).toBe(3);
    const [e] = mapRuffDiagnostics(
      [{ code: "F821", message: "x", start_location: loc(1, 1) }],
      "abc"
    );
    expect(e).toMatchObject({ from: 0, to: 0 });
  });

  it("ignores malformed input", () => {
    expect(mapRuffDiagnostics(null, "x")).toEqual([]);
    expect(mapRuffDiagnostics([null, { code: "F1" }], "x")).toEqual([]);
    expect(mapRuffDiagnostics([], undefined)).toEqual([]);
  });
});

describe("countDiagnostics", () => {
  it("splits errors and warnings", () => {
    expect(countDiagnostics([{ severity: "error" }, { severity: "warning" }, { severity: "warning" }])).toEqual({
      errors: 1,
      warnings: 2,
      total: 3,
    });
    expect(countDiagnostics(null)).toEqual({ errors: 0, warnings: 0, total: 0 });
  });
});
