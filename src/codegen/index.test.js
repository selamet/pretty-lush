import { describe, expect, it } from "vitest";
import { TYPEGEN_TARGETS, generateTypes, getTypegenTarget } from "./index.js";

describe("generateTypes", () => {
  it("has a highlight language and filename per target", () => {
    expect(TYPEGEN_TARGETS.map((t) => [t.id, t.lang, t.filename])).toEqual([
      ["typescript", "typescript", "types.ts"],
      ["zod", "typescript", "schema.ts"],
      ["pydantic", "python", "models.py"],
    ]);
    expect(getTypegenTarget("nope").id).toBe("typescript");
  });

  it("generates code from JSON text for every target", () => {
    for (const t of TYPEGEN_TARGETS) {
      expect(generateTypes(t.id, '{"a": 1}')).toMatch(/Root/);
    }
  });

  it("falls back to Root for a blank root name", () => {
    expect(generateTypes("typescript", '{"a": 1}', { rootName: "   " })).toMatch(/^export interface Root /);
  });

  it("reports invalid JSON with a position", () => {
    expect.assertions(3);
    try {
      generateTypes("typescript", '{\n  "a": 1,\n}');
    } catch (e) {
      expect(e.message).toMatch(/^Invalid JSON/);
      expect(e.line).toBe(3);
      expect(e.hint).toBeTruthy();
    }
  });

  it("rejects empty input", () => {
    expect(() => generateTypes("zod", "  ")).toThrow(/empty/);
  });
});
