import { describe, expect, it } from "vitest";
import { generateFromValue } from "./index.js";

const ts = (value, opts) => generateFromValue("typescript", value, opts);

describe("TypeScript emitter", () => {
  it("emits interfaces for the root and nested objects", () => {
    expect(ts({ id: 1, name: "Ada", address: { city: "London", zip: null } })).toBe(
      [
        "export interface Root {",
        "  id: number;",
        "  name: string;",
        "  address: Address;",
        "}",
        "",
        "export interface Address {",
        "  city: string;",
        "  zip: null;",
        "}",
        "",
      ].join("\n")
    );
  });

  it("makes fields missing in some array elements optional and adds null", () => {
    const out = ts({ users: [{ name: "a", email: "x" }, { name: "b", email: null, age: 3 }] });
    expect(out).toContain("  users: User[];");
    expect(out).toContain("export interface User {\n  name: string;\n  email: string | null;\n  age?: number;\n}");
  });

  it("emits unions for mixed primitives", () => {
    expect(ts({ v: [1, "a", true, null] })).toContain("  v: (string | number | boolean | null)[];");
    expect(ts([{ v: 1 }, { v: "x" }])).toContain("  v: string | number;");
  });

  it("handles empty arrays and empty objects", () => {
    const out = ts({ list: [], meta: {} });
    expect(out).toContain("  list: unknown[];");
    expect(out).toContain("  meta: Record<string, unknown>;");
  });

  it("handles nested arrays of objects", () => {
    const out = ts({ grid: [[{ x: 1 }], [{ x: 2, y: 3 }]] });
    expect(out).toContain("  grid: GridItem[][];");
    expect(out).toContain("export interface GridItem {\n  x: number;\n  y?: number;\n}");
  });

  it("aliases top-level arrays and names the element type", () => {
    expect(ts([{ id: 1 }, { id: 2 }])).toBe(
      "export type Root = RootItem[];\n\nexport interface RootItem {\n  id: number;\n}\n"
    );
    expect(ts([{ id: 1 }], { rootName: "Users" })).toMatch(/^export type Users = User\[\];/);
    expect(ts([])).toBe("export type Root = unknown[];\n");
  });

  it("aliases top-level primitives", () => {
    expect(ts("hi")).toBe("export type Root = string;\n");
    expect(ts(3.5)).toBe("export type Root = number;\n");
    expect(ts(null)).toBe("export type Root = null;\n");
    expect(ts({})).toBe("export type Root = Record<string, unknown>;\n");
  });

  it("quotes keys that aren't identifiers", () => {
    const out = ts({ "first-name": "a", "2fa": true, $ok: 1, "a b": 2 });
    expect(out).toContain('  "first-name": string;');
    expect(out).toContain('  "2fa": boolean;');
    expect(out).toContain("  $ok: number;");
    expect(out).toContain('  "a b": number;');
  });

  it("keeps ISO date-times as string with a note", () => {
    expect(ts({ at: "2024-01-02T03:04:05Z" })).toContain("  at: string; // ISO 8601 date-time");
  });

  it("uses the root name", () => {
    expect(ts({ a: 1 }, { rootName: "Payload" })).toMatch(/^export interface Payload \{/);
  });
});
