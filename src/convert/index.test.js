import { describe, expect, it } from "vitest";
import {
  CONVERSIONS,
  ConvertError,
  conversionsFrom,
  convertData,
  parseData,
  stringifyData,
} from "./index.js";

const SAMPLE = {
  name: "pretty-lush",
  version: "0.1.0",
  private: true,
  stars: 42,
  ratio: 0.75,
  keywords: ["formatter", "wasm"],
  author: { name: "ada", email: "ada@example.com" },
  bin: [{ name: "lush", path: "bin/lush" }, { name: "pl", path: "bin/pl" }],
};

const ROWS = [
  { id: 1, name: "ada", role: "engineer", active: true },
  { id: 2, name: "Doe, Jane", role: 'the "boss"', active: false },
];

describe("CONVERSIONS", () => {
  it("covers every ordered pair of the four formats once", () => {
    expect(CONVERSIONS).toHaveLength(12);
    expect(new Set(CONVERSIONS.map((c) => c.id)).size).toBe(12);
    expect(CONVERSIONS.slice(0, 6).map((c) => c.label)).toEqual([
      "JSON → YAML",
      "YAML → JSON",
      "JSON → TOML",
      "TOML → JSON",
      "JSON → CSV",
      "CSV → JSON",
    ]);
  });

  it("lists targets for a source format", () => {
    expect(conversionsFrom("json").map((c) => c.to)).toEqual(["yaml", "toml", "csv"]);
    expect(conversionsFrom("python")).toEqual([]);
  });
});

describe("round trips", () => {
  it.each(["yaml", "toml"])("JSON → %s → JSON preserves the data", async (fmt) => {
    const json = JSON.stringify(SAMPLE);
    const mid = await convertData("json", fmt, json);
    const back = await convertData(fmt, "json", mid);
    expect(JSON.parse(back)).toEqual(SAMPLE);
  });

  it("JSON → CSV → JSON preserves an array of objects", async () => {
    const csv = await convertData("json", "csv", JSON.stringify(ROWS));
    expect(csv).toBe(
      'id,name,role,active\n1,ada,engineer,true\n2,"Doe, Jane","the ""boss""",false\n'
    );
    expect(JSON.parse(await convertData("csv", "json", csv))).toEqual(ROWS);
  });

  it("YAML → TOML → YAML preserves the data", async () => {
    const yaml = await stringifyData("yaml", SAMPLE);
    const toml = await convertData("yaml", "toml", yaml);
    expect(await parseData("yaml", await convertData("toml", "yaml", toml))).toEqual(SAMPLE);
  });

  it("CSV → YAML → CSV is stable", async () => {
    const csv = "a,b\n1,x\n2,\"y,z\"\n";
    const yaml = await convertData("csv", "yaml", csv);
    expect(await convertData("yaml", "csv", yaml)).toBe(csv);
  });
});

describe("output shape", () => {
  it("honours the indent setting", async () => {
    expect(await stringifyData("json", { a: [1] }, { indent: 4 })).toBe('{\n    "a": [\n        1\n    ]\n}\n');
    expect(await stringifyData("json", { a: 1 }, { indent: "tab" })).toBe('{\n\t"a": 1\n}\n');
    expect(await stringifyData("yaml", { a: { b: 1 } }, { indent: 4 })).toBe("a:\n    b: 1\n");
  });

  it("turns TOML datetimes into ISO strings", async () => {
    const v = await parseData("toml", "d = 1979-05-27T07:32:00Z\nday = 1979-05-27\n");
    expect(v).toEqual({ d: "1979-05-27T07:32:00.000Z", day: "1979-05-27" });
  });
});

describe("errors", () => {
  it("reports invalid source text with a position when available", async () => {
    await expect(parseData("json", "{oops")).rejects.toThrow(/^Invalid JSON/);
    const yamlErr = await parseData("yaml", "a: [").catch((e) => e);
    expect(yamlErr).toBeInstanceOf(ConvertError);
    expect(yamlErr.message).toMatch(/^Invalid YAML/);
    expect(yamlErr.line).toBe(1);
    const tomlErr = await parseData("toml", "a = 1\nb =").catch((e) => e);
    expect(tomlErr.message).toMatch(/^Invalid TOML/);
    expect(tomlErr.line).toBe(2);
  });

  it("rejects empty input", async () => {
    await expect(convertData("json", "yaml", "  \n")).rejects.toThrow(/empty/);
  });

  it("explains values a target can't represent", async () => {
    await expect(convertData("json", "csv", '{"a":1}')).rejects.toThrow(/CSV needs an array of objects/);
    await expect(convertData("json", "toml", "[1,2]")).rejects.toThrow(/TOML needs a table/);
    await expect(convertData("json", "toml", '{"a":{"b":null}}')).rejects.toThrow(/null at "a.b"/);
  });
});
