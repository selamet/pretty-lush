import { describe, expect, it } from "vitest";
import { jsonToPython, pythonToJson } from "./python-json.js";

const parse = (src) => JSON.parse(pythonToJson(src));

describe("pythonToJson", () => {
  it("converts a typical repr() dict", () => {
    const src = "{'name': 'Ada', 'active': True, 'score': 9.5, 'tags': ['a', 'b'], 'meta': None}";
    expect(parse(src)).toEqual({
      name: "Ada",
      active: true,
      score: 9.5,
      tags: ["a", "b"],
      meta: null,
    });
  });

  it("formats with the requested indent and a trailing newline", () => {
    expect(pythonToJson("[1, 2]", { indent: 2 })).toBe("[\n  1,\n  2\n]\n");
  });

  it("turns tuples and sets into arrays", () => {
    expect(parse("{'t': (1, 2), 's': {3, 4}, 'one': (5,)}")).toEqual({
      t: [1, 2],
      s: [3, 4],
      one: [5],
    });
  });

  it("keeps keywords that appear inside strings untouched", () => {
    expect(parse(`{"msg": 'True, None, False', 'x': "it's"}`)).toEqual({
      msg: "True, None, False",
      x: "it's",
    });
  });

  it("handles escapes, raw/byte prefixes and triple-quoted strings", () => {
    expect(parse(String.raw`['a\nb', r'a\nb', b'bytes', '\x41é', '''tri'ple''']`)).toEqual([
      "a\nb",
      "a\\nb",
      "bytes",
      "Aé",
      "tri'ple",
    ]);
  });

  it("parses numeric forms: hex, underscores, exponents, signs", () => {
    expect(parse("[0x1F, 1_000, 1e3, -2.5, +3, .5]")).toEqual([31, 1000, 1000, -2.5, 3, 0.5]);
  });

  it("maps nan/inf to null and stringifies non-string dict keys", () => {
    expect(parse("{1: nan, True: inf}")).toEqual({ 1: null, true: null });
  });

  it("allows trailing commas and comments", () => {
    expect(parse("[\n  1,  # first\n  2,\n]")).toEqual([1, 2]);
  });

  it("returns an empty string for blank input", () => {
    expect(pythonToJson("   \n")).toBe("");
  });

  it("reports position on unknown identifiers", () => {
    expect(() => pythonToJson("{'a': datetime}")).toThrow(/Unknown identifier 'datetime'.*line 1, column 15/);
  });

  it("rejects complex numbers, unterminated strings and trailing content", () => {
    expect(() => pythonToJson("1j")).toThrow(/Complex numbers/);
    expect(() => pythonToJson("'abc")).toThrow(/Unterminated string/);
    expect(() => pythonToJson("[1] [2]")).toThrow(/trailing content/);
  });
});

describe("jsonToPython", () => {
  it("emits Python literals with 4-space indent by default", () => {
    expect(jsonToPython('{"a": true, "b": null, "c": [1, "x"]}')).toBe(
      "{\n    'a': True,\n    'b': None,\n    'c': [\n        1,\n        'x',\n    ],\n}\n"
    );
  });

  it("picks the quote style that avoids escaping", () => {
    expect(jsonToPython(`["it's", "say \\"hi\\"", "both ' \\""]`)).toBe(
      `[\n    "it's",\n    'say "hi"',\n    'both \\' "',\n]\n`
    );
  });

  it("emits empty containers inline", () => {
    expect(jsonToPython('{"a": [], "b": {}}')).toBe("{\n    'a': [],\n    'b': {},\n}\n");
  });

  it("throws a friendly error on invalid JSON and returns '' for blank input", () => {
    expect(() => jsonToPython("{nope}")).toThrow(/^Invalid JSON/);
    expect(jsonToPython("  ")).toBe("");
  });

  it("round-trips through pythonToJson", () => {
    const data = { a: [1, 2.5, "q'uote"], b: { c: null, d: false } };
    expect(parse(jsonToPython(JSON.stringify(data)))).toEqual(data);
  });
});
