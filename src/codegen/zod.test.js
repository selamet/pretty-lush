import { describe, expect, it } from "vitest";
import { generateFromValue } from "./index.js";

const zod = (value, opts) => generateFromValue("zod", value, opts);

describe("Zod emitter", () => {
  it("declares nested schemas before the schemas that use them", () => {
    expect(zod({ id: 1, address: { city: "London" } })).toBe(
      [
        'import { z } from "zod";',
        "",
        "export const AddressSchema = z.object({",
        "  city: z.string(),",
        "});",
        "export type Address = z.infer<typeof AddressSchema>;",
        "",
        "export const RootSchema = z.object({",
        "  id: z.number().int(),",
        "  address: AddressSchema,",
        "});",
        "export type Root = z.infer<typeof RootSchema>;",
        "",
      ].join("\n")
    );
  });

  it("marks optional and nullable fields", () => {
    const out = zod([{ a: "x", b: 1.5 }, { a: null }]);
    expect(out).toContain("  a: z.string().nullable(),");
    expect(out).toContain("  b: z.number().optional(),");
  });

  it("emits unions, null-only and unknown", () => {
    const out = zod({ mixed: [1, "a"], n: null, e: [], m: {} });
    expect(out).toContain("  mixed: z.array(z.union([z.string(), z.number().int()])),");
    expect(out).toContain("  n: z.null(),");
    expect(out).toContain("  e: z.array(z.unknown()),");
    expect(out).toContain("  m: z.record(z.string(), z.unknown()),");
  });

  it("handles nested arrays of objects", () => {
    const out = zod({ rows: [[{ v: true }]] });
    expect(out).toContain("export const RowSchema = z.object({\n  v: z.boolean(),\n});");
    expect(out).toContain("  rows: z.array(z.array(RowSchema)),");
  });

  it("emits a root schema for top-level arrays", () => {
    const out = zod([{ id: 1 }, { id: 2, tag: "x" }]);
    expect(out).toContain("export const RootItemSchema = z.object({\n  id: z.number().int(),\n  tag: z.string().optional(),\n});");
    expect(out.trimEnd().endsWith(
      "export const RootSchema = z.array(RootItemSchema);\nexport type Root = z.infer<typeof RootSchema>;"
    )).toBe(true);
    expect(zod([])).toContain("export const RootSchema = z.array(z.unknown());");
  });

  it("emits a root schema for primitives", () => {
    expect(zod(true)).toBe(
      'import { z } from "zod";\n\nexport const RootSchema = z.boolean();\nexport type Root = z.infer<typeof RootSchema>;\n'
    );
    expect(zod(null)).toContain("export const RootSchema = z.null();");
  });

  it("quotes non-identifier keys and notes date-times", () => {
    const out = zod({ "user-id": 1, at: "2024-01-02T03:04:05Z" });
    expect(out).toContain('  "user-id": z.number().int(),');
    expect(out).toContain("  at: z.string(), // ISO 8601 date-time");
  });

  it("puts nullable before optional", () => {
    expect(zod([{ a: null }, {}])).toContain("  a: z.null().optional(),");
    expect(zod([{ a: "x" }, { a: null }, {}])).toContain("  a: z.string().nullable().optional(),");
  });
});
