import { describe, it, expect } from "vitest";
import {
  SchemaError,
  describeError,
  detectDialect,
  mapAjvErrors,
  parseJsonText,
  validateJson,
} from "./validate.js";

describe("detectDialect", () => {
  it("defaults to 2020-12 and recognises draft-07 / 2020-12 URIs", () => {
    expect(detectDialect({})).toBe("2020-12");
    expect(detectDialect(true)).toBe("2020-12");
    expect(detectDialect({ $schema: "http://json-schema.org/draft-07/schema#" })).toBe("draft-07");
    expect(detectDialect({ $schema: "https://json-schema.org/draft-07/schema" })).toBe("draft-07");
    expect(detectDialect({ $schema: "https://json-schema.org/draft/2020-12/schema" })).toBe("2020-12");
  });

  it("rejects other drafts with a hint", () => {
    expect(() => detectDialect({ $schema: "http://json-schema.org/draft-04/schema#" })).toThrow(
      /Unsupported \$schema/
    );
    expect(() => detectDialect({ $schema: 7 })).toThrow(SchemaError);
  });
});

describe("parseJsonText", () => {
  it("reports line and column of syntax errors", () => {
    try {
      parseJsonText('{\n  "a": 1,\n}', "Schema");
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(SchemaError);
      expect(e.message).toMatch(/^Schema is not valid JSON/);
      expect(e.line).toBe(3);
    }
  });
});

describe("describeError / mapAjvErrors", () => {
  it("adds the offending property / allowed values to Ajv messages", () => {
    expect(
      describeError({ keyword: "additionalProperties", message: "must NOT have additional properties", params: { additionalProperty: "x" } })
    ).toBe('must NOT have additional property "x"');
    expect(
      describeError({ keyword: "enum", message: "must be equal to one of the allowed values", params: { allowedValues: ["a", 1] } })
    ).toBe('must be equal to one of the allowed values: "a", 1');
  });

  it("maps pointers to positions and sorts by position", () => {
    const text = '{\n  "a": "x",\n  "b": [1, "two"]\n}';
    const out = mapAjvErrors(
      [
        { instancePath: "/b/1", keyword: "type", message: "must be integer", schemaPath: "#/x" },
        { instancePath: "/a", keyword: "type", message: "must be number" },
        { instancePath: "", keyword: "additionalProperties", message: "m", params: { additionalProperty: "b" } },
      ],
      text
    );
    expect(out.map((e) => [e.instancePath, e.line, e.column, text.slice(e.from, e.to)])).toEqual([
      ["/a", 2, 3, '"a"'],
      ["", 3, 3, '"b"'],
      ["/b/1", 3, 12, '"two"'],
    ]);
  });
});

describe("validateJson", () => {
  const schema07 = JSON.stringify({
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    properties: { email: { type: "string", format: "email" }, n: { type: "integer" } },
    required: ["email", "n"],
  });

  it("returns valid for matching documents", async () => {
    expect(await validateJson('{"email":"a@b.co","n":1}', schema07)).toEqual({
      status: "valid",
      dialect: "draft-07",
    });
  });

  it("lists every error (allErrors) with formats checked", async () => {
    const r = await validateJson('{"email":"nope","n":1.5}', schema07);
    expect(r.status).toBe("invalid");
    expect(r.errors.map((e) => [e.instancePath, e.keyword])).toEqual([
      ["/email", "format"],
      ["/n", "type"],
    ]);
  });

  it("supports 2020-12 keywords (prefixItems, unevaluatedProperties)", async () => {
    const schema = JSON.stringify({
      type: "object",
      properties: { t: { type: "array", prefixItems: [{ type: "string" }], items: false } },
      unevaluatedProperties: false,
    });
    const r = await validateJson('{"t": [1, 2], "x": 0}', schema);
    expect(r.dialect).toBe("2020-12");
    expect(r.errors.map((e) => [e.instancePath, e.keyword])).toEqual([
      ["/t", "items"],
      ["/t/0", "type"],
      ["", "unevaluatedProperties"],
    ]);
  });

  it("reports invalid schema JSON and invalid schemas as schema errors", async () => {
    const bad = await validateJson("{}", "{ nope");
    expect(bad.status).toBe("schema-error");
    expect(bad.error.message).toMatch(/Schema is not valid JSON/);

    const invalid = await validateJson("{}", '{"type": "strnig"}');
    expect(invalid.status).toBe("schema-error");
    expect(invalid.error.message).toMatch(/^Invalid schema/);

    const notObject = await validateJson("{}", "[1]");
    expect(notObject.error.message).toMatch(/must be a JSON object/);

    const ref = await validateJson("{}", '{"$ref": "https://example.com/x.json"}');
    expect(ref.status).toBe("schema-error");
    expect(ref.error.hint).toMatch(/\$defs/);
  });

  it("reports unparsable input separately", async () => {
    const r = await validateJson("{", "{}");
    expect(r.status).toBe("input-error");
    expect(r.error.message).toMatch(/^Input is not valid JSON/);
  });

  it("recompiles when the schema changes, even with the same $id", async () => {
    const a = JSON.stringify({ $id: "https://x/s", type: "string" });
    const b = JSON.stringify({ $id: "https://x/s", type: "number" });
    expect((await validateJson("1", a)).status).toBe("invalid");
    expect((await validateJson("1", b)).status).toBe("valid");
  });
});
