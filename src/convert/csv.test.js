import { describe, expect, it } from "vitest";
import {
  csvToJson,
  inferCell,
  jsonToCsv,
  parseCsv,
  stringifyCsv,
  unionKeys,
} from "./csv.js";

describe("parseCsv", () => {
  it("splits simple rows with LF or CRLF and ignores a trailing newline", () => {
    expect(parseCsv("a,b\n1,2\n")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv("a,b\r\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("handles quoted fields with commas, doubled quotes and newlines", () => {
    const src = 'name,note\n"Doe, Jane","said ""hi""\nthen left"\n';
    expect(parseCsv(src)).toEqual([
      ["name", "note"],
      ["Doe, Jane", 'said "hi"\nthen left'],
    ]);
  });

  it("keeps empty fields", () => {
    expect(parseCsv("a,,c\n,,\n")).toEqual([["a", "", "c"], ["", "", ""]]);
  });

  it("strips a BOM", () => {
    expect(parseCsv("﻿a\n1")).toEqual([["a"], ["1"]]);
  });

  it("rejects unterminated quotes and junk after a closing quote", () => {
    expect(() => parseCsv('a\n"oops')).toThrow(/Unterminated/);
    expect(() => parseCsv('"a"b,c')).toThrow(/after closing quote on line 1/);
  });
});

describe("stringifyCsv", () => {
  it("quotes only when needed (RFC 4180)", () => {
    expect(
      stringifyCsv([["a", "b,c", 'q"q', "line\nbreak", " pad"]])
    ).toBe('a,"b,c","q""q","line\nbreak"," pad"\n');
  });

  it("round-trips through parseCsv", () => {
    const rows = [["x", "y"], ['"', ",\r\n"], ["", "plain"]];
    expect(parseCsv(stringifyCsv(rows))).toEqual(rows);
  });
});

describe("unionKeys", () => {
  it("keeps first-seen order", () => {
    expect(unionKeys([{ b: 1, a: 1 }, { c: 1, a: 2 }])).toEqual(["b", "a", "c"]);
  });
});

describe("inferCell", () => {
  it.each([
    ["42", 42],
    ["-3.5", -3.5],
    ["1e3", 1000],
    ["0", 0],
    ["true", true],
    ["false", false],
    ["null", null],
    ['{"a":1}', { a: 1 }],
    ["[1,2]", [1, 2]],
  ])("infers %j", (s, v) => expect(inferCell(s)).toEqual(v));

  it.each(["007", "", " 1", "1.", "+1", "9007199254740993", "TRUE", "[not json", "0x10", "Infinity"])(
    "keeps %j as text",
    (s) => expect(inferCell(s)).toBe(s)
  );
});

describe("jsonToCsv", () => {
  it("writes a header from the union of keys and JSON-stringifies nested values", () => {
    const csv = jsonToCsv([
      { id: 1, name: "ada", tags: ["a", "b"] },
      { id: 2, meta: { x: 1 }, name: null },
    ]);
    expect(csv).toBe(
      'id,name,tags,meta\n1,ada,"[""a"",""b""]",\n2,,,"{""x"":1}"\n'
    );
  });

  it("accepts an array of arrays as raw rows", () => {
    expect(jsonToCsv([["a", "b"], [1, true]])).toBe("a,b\n1,true\n");
  });

  it("explains non-convertible input", () => {
    expect(() => jsonToCsv({ a: 1 })).toThrow(/array of objects.*input is an object/);
    expect(() => jsonToCsv("x")).toThrow(/input is a string/);
    expect(() => jsonToCsv([])).toThrow(/empty/);
    expect(() => jsonToCsv([{ a: 1 }, 2])).toThrow(/item 1 is a number/);
    expect(() => jsonToCsv([{}])).toThrow(/no keys/);
  });
});

describe("csvToJson", () => {
  it("maps rows to objects with conservative inference", () => {
    expect(csvToJson("id,name,active,zip\n1,ada,true,02134\n")).toEqual([
      { id: 1, name: "ada", active: true, zip: "02134" },
    ]);
  });

  it("fills short rows with empty strings and skips blank lines", () => {
    expect(csvToJson("a,b\n1\n\n2,3\n")).toEqual([
      { a: 1, b: "" },
      { a: 2, b: 3 },
    ]);
  });

  it("rejects empty input, duplicate headers and over-long rows", () => {
    expect(() => csvToJson("\n")).toThrow(/empty/);
    expect(() => csvToJson("a,a\n1,2")).toThrow(/Duplicate column name "a"/);
    expect(() => csvToJson("a,b\n1,2,3")).toThrow(/Record 2 has 3 fields/);
  });

  it("round-trips JSON → CSV → JSON", () => {
    const data = [
      { id: 1, name: "Doe, Jane", note: 'said "hi"\nbye', score: 9.5, ok: true, tags: ["x", "y"] },
      { id: 2, name: "linus", note: "", score: -1, ok: false, tags: [] },
      { id: 3, name: "  spaced  ", note: "007", score: 0, ok: true, tags: [{ k: 1 }] },
    ];
    expect(csvToJson(jsonToCsv(data))).toEqual(data);
  });
});
