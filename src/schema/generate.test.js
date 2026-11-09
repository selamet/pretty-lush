import { describe, it, expect } from "vitest";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { generateSchema, generateSchemaText } from "./generate.js";

function accepts(schema, value) {
  const ajv = new Ajv2020({ strict: true });
  addFormats(ajv);
  return ajv.validate(schema, value);
}

describe("generateSchema", () => {
  it("emits a 2020-12 schema for objects with required keys", () => {
    expect(generateSchema({ id: 1, name: "ada", ok: true })).toEqual({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        id: { type: "integer" },
        name: { type: "string" },
        ok: { type: "boolean" },
      },
      required: ["id", "name", "ok"],
    });
  });

  it("merges array elements: missing keys are optional, null is nullable, int+float is number", () => {
    const s = generateSchema([
      { id: 1, score: 1, note: "x" },
      { id: 2, score: 1.5, note: null },
    ].concat([{ id: 3, score: 2 }]));
    expect(s.type).toBe("array");
    expect(s.items.required).toEqual(["id", "score"]);
    expect(s.items.properties.score).toEqual({ type: "number" });
    expect(s.items.properties.note).toEqual({ type: ["string", "null"] });
  });

  it("marks ISO date-times and uses anyOf for rich unions", () => {
    const s = generateSchema({ at: "2024-01-02T03:04:05Z", v: [1, "a", { k: 1 }] });
    expect(s.properties.at).toEqual({ type: "string", format: "date-time" });
    expect(s.properties.v.items).toEqual({
      anyOf: [
        { type: "object", properties: { k: { type: "integer" } }, required: ["k"] },
        { type: ["string", "integer"] },
      ],
    });
  });

  it("leaves unknown element types open and handles empty objects and scalars", () => {
    expect(generateSchema({ a: [], b: {} }).properties).toEqual({
      a: { type: "array" },
      b: { type: "object" },
    });
    expect(generateSchema(null)).toEqual({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "null",
    });
  });

  it("produces schemas that accept the sample (strict Ajv)", () => {
    const samples = [
      [{ id: 1, tags: ["a"], at: "2024-01-01T00:00:00Z" }, { id: 2.5, extra: { x: null } }],
      { nested: { deep: [[1, 2], [3.5]] }, "weird/key~": "v" },
      "just a string",
      [],
    ];
    for (const v of samples) expect(accepts(generateSchema(v), v)).toBe(true);
  });

  it("pretty-prints with the requested indent", () => {
    expect(generateSchemaText(1, 4)).toBe(
      '{\n    "$schema": "https://json-schema.org/draft/2020-12/schema",\n    "type": "integer"\n}\n'
    );
    expect(generateSchemaText(1, "tab")).toContain('\n\t"type"');
  });
});
