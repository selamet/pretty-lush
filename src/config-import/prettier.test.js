import { describe, it, expect } from "vitest";
import { mapPackageJson, mapPrettierConfig } from "./prettier.js";

const reasonOf = (r, option) => r.ignored.find((i) => i.option === option)?.reason;

describe("mapPrettierConfig", () => {
  it("maps every supported option", () => {
    const r = mapPrettierConfig({
      printWidth: 100,
      tabWidth: 4,
      singleQuote: true,
      semi: false,
      trailingComma: "es5",
      bracketSpacing: false,
      arrowParens: "avoid",
      proseWrap: "always",
      endOfLine: "crlf",
    });
    expect(r.patch).toEqual({
      lineWidth: 100,
      indent: 4,
      quotes: "single",
      semi: false,
      trailingComma: "es5",
      bracketSpacing: false,
      arrowParens: "avoid",
      proseWrap: "always",
      endOfLine: "crlf",
    });
    expect(r.ignored).toEqual([]);
    expect(r.applied.map((a) => a.option)).toContain("tabWidth");
  });

  it("singleQuote: false means double quotes", () => {
    expect(mapPrettierConfig({ singleQuote: false }).patch).toEqual({ quotes: "double" });
  });

  it("useTabs wins over tabWidth", () => {
    const r = mapPrettierConfig({ tabWidth: 8, useTabs: true });
    expect(r.patch).toEqual({ indent: "tab" });
    expect(reasonOf(r, "tabWidth")).toMatch(/useTabs/);
  });

  it("useTabs: false without tabWidth means Prettier's 2 spaces", () => {
    expect(mapPrettierConfig({ useTabs: false }).patch).toEqual({ indent: 2 });
    expect(mapPrettierConfig({ useTabs: false, tabWidth: 4 }).patch).toEqual({ indent: 4 });
  });

  it("only touches options present in the config", () => {
    expect(mapPrettierConfig({ semi: false }).patch).toEqual({ semi: false });
  });

  it("reports invalid values", () => {
    const r = mapPrettierConfig({
      printWidth: "wide",
      tabWidth: 0,
      useTabs: "yes",
      semi: 1,
      trailingComma: "sometimes",
    });
    expect(r.patch).toEqual({});
    for (const k of ["printWidth", "tabWidth", "useTabs", "semi", "trailingComma"]) {
      expect(reasonOf(r, k)).toMatch(/invalid value/);
    }
  });

  it("reports unsupported, special and unknown options; skips $schema", () => {
    const r = mapPrettierConfig({
      $schema: "https://json.schemastore.org/prettierrc",
      jsxSingleQuote: true,
      overrides: [{ files: "*.md", options: {} }],
      plugins: ["prettier-plugin-tailwindcss"],
      fancyOption: 1,
    });
    expect(r.patch).toEqual({});
    expect(reasonOf(r, "jsxSingleQuote")).toBe("not supported by pretty-lush");
    expect(reasonOf(r, "overrides")).toMatch(/overrides/);
    expect(reasonOf(r, "plugins")).toMatch(/plugins/);
    expect(reasonOf(r, "fancyOption")).toBe("unknown option");
    expect(reasonOf(r, "$schema")).toBeUndefined();
  });
});

describe("mapPackageJson", () => {
  it("reads the prettier key", () => {
    expect(mapPackageJson({ name: "x", prettier: { semi: false } }).patch).toEqual({ semi: false });
  });

  it("explains a missing key, a shared config string and garbage", () => {
    expect(mapPackageJson({ name: "x" }).ignored[0].reason).toMatch(/no "prettier" key/);
    expect(mapPackageJson({ prettier: "@company/prettier-config" }).ignored[0].reason).toMatch(
      /@company\/prettier-config/
    );
    expect(mapPackageJson({ prettier: [1] }).ignored[0].reason).toMatch(/invalid/);
  });
});
