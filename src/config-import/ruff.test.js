import { describe, it, expect } from "vitest";
import { mapRuffConfig } from "./ruff.js";

const reasonOf = (r, option) => r.ignored.find((i) => i.option === option)?.reason;

describe("mapRuffConfig", () => {
  it("maps line-length, indent-width and quote-style to Python overrides", () => {
    const r = mapRuffConfig({
      "line-length": 100,
      "indent-width": 2,
      format: { "quote-style": "single" },
    });
    expect(r.patch).toEqual({ pythonLineWidth: 100, pythonIndent: 2, pythonQuotes: "single" });
    expect(r.ignored).toEqual([]);
  });

  it("never touches the shared settings", () => {
    const r = mapRuffConfig({ "line-length": 88 });
    expect(Object.keys(r.patch)).toEqual(["pythonLineWidth"]);
  });

  it("indent-style = tab wins over indent-width; space defaults to 4", () => {
    const tabs = mapRuffConfig({ "indent-width": 2, format: { "indent-style": "tab" } });
    expect(tabs.patch).toEqual({ pythonIndent: "tab" });
    expect(reasonOf(tabs, "indent-width")).toMatch(/tabs/);
    expect(mapRuffConfig({ format: { "indent-style": "space" } }).patch).toEqual({ pythonIndent: 4 });
  });

  it("reads [tool.ruff] from pyproject.toml", () => {
    const r = mapRuffConfig(
      {
        project: { name: "x" },
        tool: { ruff: { "line-length": 120, format: { "quote-style": "preserve" } }, black: {} },
      },
      { pyproject: true }
    );
    expect(r.patch).toEqual({ pythonLineWidth: 120, pythonQuotes: "preserve" });
    expect(r.applied[0].option).toBe("tool.ruff.line-length");
  });

  it("throws when pyproject.toml has no [tool.ruff]", () => {
    expect(() => mapRuffConfig({ project: {} }, { pyproject: true })).toThrow(/tool\.ruff/);
  });

  it("reports lint, unsupported and invalid options", () => {
    const r = mapRuffConfig({
      "line-length": 999,
      "indent-width": "four",
      "target-version": "py312",
      select: ["E"],
      lint: { select: ["F"] },
      format: { "quote-style": "backtick", "docstring-code-format": true, "indent-style": "weird" },
    });
    expect(r.patch).toEqual({});
    expect(reasonOf(r, "line-length")).toMatch(/invalid/);
    expect(reasonOf(r, "indent-width")).toMatch(/invalid/);
    expect(reasonOf(r, "target-version")).toBe("not supported by pretty-lush");
    expect(reasonOf(r, "select")).toMatch(/lint/);
    expect(reasonOf(r, "lint")).toMatch(/lint/);
    expect(reasonOf(r, "format.quote-style")).toMatch(/invalid/);
    expect(reasonOf(r, "format.docstring-code-format")).toBe("not supported by pretty-lush");
    expect(reasonOf(r, "format.indent-style")).toMatch(/invalid/);
  });
});
