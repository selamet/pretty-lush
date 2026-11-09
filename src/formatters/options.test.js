import { describe, it, expect } from "vitest";
import { formatWithPrettier, prettierOptions } from "./prettier.js";
import { ruffSettings } from "./python.js";
import { DEFAULT_SETTINGS } from "../state/settings.js";

describe("prettierOptions", () => {
  it("defaults match Prettier 3", () => {
    const o = prettierOptions("babel", DEFAULT_SETTINGS);
    expect(o).toMatchObject({
      parser: "babel",
      tabWidth: 2,
      useTabs: false,
      printWidth: 80,
      singleQuote: false,
      semi: true,
      trailingComma: "all",
      bracketSpacing: true,
      arrowParens: "always",
      proseWrap: "preserve",
      endOfLine: "lf",
    });
  });

  it("passes imported options through and falls back on invalid ones", () => {
    const o = prettierOptions("typescript", {
      indent: "tab",
      lineWidth: 100,
      quotes: "single",
      semi: false,
      trailingComma: "none",
      bracketSpacing: false,
      arrowParens: "avoid",
      proseWrap: "always",
      endOfLine: "crlf",
    });
    expect(o).toMatchObject({
      useTabs: true,
      printWidth: 100,
      singleQuote: true,
      semi: false,
      trailingComma: "none",
      bracketSpacing: false,
      arrowParens: "avoid",
      proseWrap: "always",
      endOfLine: "crlf",
    });
    const fallback = prettierOptions("babel", { trailingComma: "x", arrowParens: 1 });
    expect(fallback.trailingComma).toBe("all");
    expect(fallback.arrowParens).toBe("always");
  });
});

describe("formatWithPrettier honours imported options", () => {
  const src = "const f = (x) => ({a: x, b: 'y'});\nconst list = [\n  1,\n  2];\n";

  it("defaults", async () => {
    const out = await formatWithPrettier(src, "babel", DEFAULT_SETTINGS);
    expect(out).toBe('const f = (x) => ({ a: x, b: "y" });\nconst list = [1, 2];\n');
  });

  it("semi, quotes, bracket spacing, arrow parens", async () => {
    const out = await formatWithPrettier(src, "babel", {
      ...DEFAULT_SETTINGS,
      semi: false,
      quotes: "single",
      bracketSpacing: false,
      arrowParens: "avoid",
    });
    expect(out).toBe("const f = x => ({a: x, b: 'y'})\nconst list = [1, 2]\n");
  });

  it("trailing commas and line endings", async () => {
    const code = "call(aaaaaaaaaaaa, bbbbbbbbbbbbbbbbb, ccccccccccccccccc);";
    const all = await formatWithPrettier(code, "babel", { ...DEFAULT_SETTINGS, lineWidth: 30 });
    expect(all).toContain("ccccccccccccccccc,\n");
    const none = await formatWithPrettier(code, "babel", {
      ...DEFAULT_SETTINGS,
      lineWidth: 30,
      trailingComma: "none",
      endOfLine: "crlf",
    });
    expect(none).toContain("ccccccccccccccccc\r\n");
  });
});

describe("ruffSettings", () => {
  it("uses the shared settings when there are no Python overrides", () => {
    expect(ruffSettings({ ...DEFAULT_SETTINGS, indent: 2, lineWidth: 100, quotes: "single" })).toEqual({
      "line-length": 100,
      "indent-width": 2,
      format: { "indent-style": "space", "quote-style": "single" },
    });
  });

  it("Python overrides win", () => {
    expect(
      ruffSettings({
        ...DEFAULT_SETTINGS,
        pythonIndent: "tab",
        pythonLineWidth: 88,
        pythonQuotes: "preserve",
      })
    ).toEqual({
      "line-length": 88,
      "indent-width": 4,
      format: { "indent-style": "tab", "quote-style": "preserve" },
    });
  });
});
