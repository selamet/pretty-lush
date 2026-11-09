import { describe, it, expect } from "vitest";
import {
  ConfigImportError,
  describeSetting,
  detectConfigFormat,
  formatFromFilename,
  importConfig,
  sniffFormat,
} from "./index.js";

describe("formatFromFilename", () => {
  it("recognizes config file names", () => {
    expect(formatFromFilename("package.json")).toBe("package-json");
    expect(formatFromFilename("repo/.editorconfig")).toBe("editorconfig");
    expect(formatFromFilename("C:\\repo\\pyproject.toml")).toBe("pyproject");
    expect(formatFromFilename("ruff.toml")).toBe("ruff");
    expect(formatFromFilename(".ruff.toml")).toBe("ruff");
    for (const n of [".prettierrc", ".prettierrc.json", ".prettierrc.yaml", ".prettierrc.yml", ".prettierrc.toml", ".prettierrc.json5"]) {
      expect(formatFromFilename(n)).toBe("prettier");
    }
    expect(formatFromFilename("notes.txt")).toBeNull();
    expect(formatFromFilename("")).toBeNull();
  });

  it("rejects JavaScript configs with a helpful message", () => {
    expect(() => formatFromFilename("prettier.config.js")).toThrow(ConfigImportError);
    expect(() => formatFromFilename(".prettierrc.cjs")).toThrow(/as JSON/);
  });
});

describe("sniffFormat", () => {
  it("tells formats apart from the text", () => {
    expect(sniffFormat('{ "semi": false }')).toBe("prettier");
    expect(sniffFormat('{ "name": "app", "prettier": { "semi": false } }')).toBe("package-json");
    expect(sniffFormat("semi: false\nsingleQuote: true")).toBe("prettier");
    expect(sniffFormat("root = true\n[*]\nindent_size = 2")).toBe("editorconfig");
    expect(sniffFormat("[project]\nname='x'\n[tool.ruff]\nline-length = 100")).toBe("pyproject");
    expect(sniffFormat("[tool.ruff.format]\nquote-style='single'")).toBe("pyproject");
    expect(sniffFormat("line-length = 100\n[format]\nquote-style = 'single'")).toBe("ruff");
  });

  it("file name wins over sniffing", () => {
    expect(detectConfigFormat("line-length = 100", "pyproject.toml")).toBe("pyproject");
    expect(detectConfigFormat('{"semi": false}', "whatever.txt")).toBe("prettier");
  });
});

describe("importConfig", () => {
  it("imports a JSON .prettierrc", async () => {
    const r = await importConfig('{ "semi": false, "singleQuote": true, "jsxSingleQuote": true }');
    expect(r.format).toBe("prettier");
    expect(r.patch).toEqual({ semi: false, quotes: "single" });
    expect(r.ignored.map((i) => i.option)).toEqual(["jsxSingleQuote"]);
  });

  it("imports a YAML .prettierrc", async () => {
    const r = await importConfig("# team style\nprintWidth: 100\nuseTabs: true\ntrailingComma: none\n", {
      filename: ".prettierrc",
    });
    expect(r.patch).toEqual({ lineWidth: 100, indent: "tab", trailingComma: "none" });
  });

  it("imports a TOML .prettierrc", async () => {
    const r = await importConfig('semi = false\narrowParens = "avoid"\n', { filename: ".prettierrc.toml" });
    expect(r.patch).toEqual({ semi: false, arrowParens: "avoid" });
    const sniffed = await importConfig('semi = false\ntabWidth = 4\n');
    expect(sniffed.patch).toEqual({ semi: false, indent: 4 });
  });

  it("imports package.json", async () => {
    const r = await importConfig(
      JSON.stringify({ name: "app", version: "1.0.0", prettier: { printWidth: 120 } }),
      { filename: "package.json" }
    );
    expect(r.format).toBe("package-json");
    expect(r.patch).toEqual({ lineWidth: 120 });
  });

  it("imports .editorconfig", async () => {
    const r = await importConfig("root = true\n\n[*]\nindent_style = tab\n", { filename: ".editorconfig" });
    expect(r.format).toBe("editorconfig");
    expect(r.patch).toEqual({ indent: "tab" });
  });

  it("imports ruff.toml", async () => {
    const r = await importConfig('line-length = 100\nindent-width = 2\n[format]\nquote-style = "single"\n', {
      filename: "ruff.toml",
    });
    expect(r.patch).toEqual({ pythonLineWidth: 100, pythonIndent: 2, pythonQuotes: "single" });
  });

  it("imports pyproject.toml [tool.ruff] / [tool.ruff.format]", async () => {
    const r = await importConfig(
      '[project]\nname = "x"\n\n[tool.ruff]\nline-length = 88\nselect = ["E"]\n\n[tool.ruff.format]\nindent-style = "tab"\n'
    );
    expect(r.format).toBe("pyproject");
    expect(r.patch).toEqual({ pythonLineWidth: 88, pythonIndent: "tab" });
    expect(r.ignored.map((i) => i.option)).toEqual(["tool.ruff.select"]);
  });

  it("an explicit format overrides detection", async () => {
    const r = await importConfig("line-length = 90", { format: "ruff", filename: "x.cfg" });
    expect(r.patch).toEqual({ pythonLineWidth: 90 });
  });

  it("rejects empty, unparsable, non-object and oversized input", async () => {
    await expect(importConfig("   ")).rejects.toThrow(/Paste a config/);
    await expect(importConfig("{ semi: false", { filename: ".prettierrc.json" })).rejects.toThrow(/JSON/);
    await expect(importConfig("key: [unclosed", { filename: ".prettierrc" })).rejects.toThrow(/YAML/);
    await expect(importConfig("just some words")).rejects.toThrow(/set of options/);
    await expect(importConfig("[1, 2]", { filename: ".prettierrc.json" })).rejects.toThrow(/set of options/);
    await expect(importConfig("line-length = = 1", { filename: "ruff.toml" })).rejects.toThrow(/TOML/);
    await expect(importConfig("[project]\nname='x'", { filename: "pyproject.toml" })).rejects.toThrow(/tool\.ruff/);
    await expect(importConfig("a".repeat(300 * 1024))).rejects.toThrow(/too large/);
    await expect(importConfig("x", { format: "nope" })).rejects.toThrow(/Unknown config format/);
  });
});

describe("describeSetting", () => {
  it("renders settings for the summary", () => {
    expect(describeSetting("indent", "tab")).toBe("tabs");
    expect(describeSetting("pythonIndent", 4)).toBe("4 spaces");
    expect(describeSetting("lineWidth", 100)).toBe("100 columns");
    expect(describeSetting("quotes", "preserve")).toBe("preserve quotes");
    expect(describeSetting("semi", false)).toBe("off");
    expect(describeSetting("bracketSpacing", true)).toBe("on");
    expect(describeSetting("endOfLine", "crlf")).toBe("CRLF");
    expect(describeSetting("trailingComma", "es5")).toBe("es5");
  });
});
