import { describe, expect, it } from "vitest";
import {
  JsonStringError,
  escapeJsonString,
  minifyJson,
  unescapeJsonString,
} from "./json-string.js";

describe("minifyJson", () => {
  it("removes insignificant whitespace", () => {
    const src = '{\n  "a": 1,\n  "b": [\n    true,\n    null\n  ]\n}\n';
    expect(minifyJson(src)).toBe('{"a":1,"b":[true,null]}');
  });

  it("keeps whitespace and escapes inside strings", () => {
    const src = '{ "msg" : "hello   world\\n\\"x\\" \\\\ " }';
    expect(minifyJson(src)).toBe('{"msg":"hello   world\\n\\"x\\" \\\\ "}');
  });

  it("preserves key order (incl. integer-like keys) and number literals", () => {
    const src = '{ "b": 1.0, "2": 12345678901234567890, "a": 1e3 }';
    expect(minifyJson(src)).toBe('{"b":1.0,"2":12345678901234567890,"a":1e3}');
  });

  it("keeps unicode and emoji untouched", () => {
    expect(minifyJson('{ "name": "Çağrı 🚀", "u": "\\u00e9" }')).toBe(
      '{"name":"Çağrı 🚀","u":"\\u00e9"}'
    );
  });

  it("minifies scalars and handles tabs / CRLF", () => {
    expect(minifyJson("  42 \r\n")).toBe("42");
    expect(minifyJson('[\r\n\t1,\r\n\t2\r\n]')).toBe("[1,2]");
  });

  it("throws with line / column on invalid JSON", () => {
    let err;
    try {
      minifyJson('{\n  "a": 1,\n}');
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(JsonStringError);
    expect(err.message).toMatch(/not valid JSON/);
    expect(err.line).toBe(3);
    expect(err.column).toBe(1);
  });

  it("rejects empty input", () => {
    expect(() => minifyJson("   ")).toThrow(/empty/);
  });
});

describe("escapeJsonString", () => {
  it("turns the whole input into a JSON string literal", () => {
    expect(escapeJsonString('{"a": "b"}')).toBe('"{\\"a\\": \\"b\\"}"');
  });

  it("escapes backslashes, newlines and control characters", () => {
    expect(escapeJsonString('a\\b\n\t\u0001"')).toBe('"a\\\\b\\n\\t\\u0001\\""');
  });

  it("keeps unicode and emoji as is", () => {
    expect(escapeJsonString("héllo 🚀")).toBe('"héllo 🚀"');
  });

  it("round-trips through unescape", () => {
    const src = 'line 1\nline "2"\t\\ end 🚀';
    expect(unescapeJsonString(escapeJsonString(src)).text).toBe(src);
  });
});

describe("unescapeJsonString", () => {
  it("decodes a quoted literal holding JSON and pretty-prints it", () => {
    const out = unescapeJsonString('"{\\"a\\":1,\\"b\\":[true]}"');
    expect(out).toEqual({
      text: '{\n  "a": 1,\n  "b": [\n    true\n  ]\n}\n',
      lang: "json",
      depth: 1,
    });
  });

  it("accepts a literal without surrounding quotes", () => {
    const out = unescapeJsonString('{\\"a\\":1}');
    expect(out.lang).toBe("json");
    expect(JSON.parse(out.text)).toEqual({ a: 1 });
  });

  it("unwraps double-encoded JSON", () => {
    // literal: "{\"id\":7,...}" — doubled: "\"{\\\"id\\\":7,...}\""
    const literal = JSON.stringify(JSON.stringify({ id: 7, tags: ["x"] }));
    const doubled = JSON.stringify(literal);
    const tripled = JSON.stringify(doubled);
    expect(unescapeJsonString(literal)).toMatchObject({ lang: "json", depth: 1 });
    expect(unescapeJsonString(doubled)).toMatchObject({ lang: "json", depth: 2 });
    expect(JSON.parse(unescapeJsonString(doubled).text)).toEqual({ id: 7, tags: ["x"] });
    expect(unescapeJsonString(tripled)).toMatchObject({ lang: "json", depth: 3 });
    // double-encoded without the outer quotes (as copied from a log line)
    expect(unescapeJsonString(doubled.slice(1, -1))).toMatchObject({ lang: "json", depth: 2 });
  });

  it("uses the requested indent", () => {
    expect(unescapeJsonString('"[1]"', { indent: 4 }).text).toBe("[\n    1\n]\n");
    expect(unescapeJsonString('"[1]"', { indent: "tab" }).text).toBe("[\n\t1\n]\n");
  });

  it("returns plain text when the decoded value is not JSON", () => {
    expect(unescapeJsonString('"hello\\nworld \\u00e9 \\ud83d\\ude80"')).toEqual({
      text: "hello\nworld é 🚀",
      lang: null,
      depth: 1,
    });
  });

  it("keeps unicode / emoji inside decoded JSON", () => {
    const out = unescapeJsonString(JSON.stringify(JSON.stringify({ s: "Çağrı 🚀" })));
    expect(out.text).toContain("Çağrı 🚀");
  });

  it("decodes control-character escapes", () => {
    expect(unescapeJsonString('"tab\\there\\u0000\\r"').text).toBe("tab\there\u0000\r");
  });

  it("tolerates raw newlines in a pasted literal", () => {
    expect(unescapeJsonString('"line 1\nline 2"').text).toBe("line 1\nline 2");
  });

  it("does not turn scalar JSON into the JSON language", () => {
    expect(unescapeJsonString('"42"')).toEqual({ text: "42", lang: null, depth: 1 });
  });

  it("rejects input that is already JSON", () => {
    expect(() => unescapeJsonString('{"a":1}')).toThrow(/already unescaped/);
  });

  it("rejects invalid string literals", () => {
    expect(() => unescapeJsonString('"bad \\x escape"')).toThrow(JsonStringError);
    expect(() => unescapeJsonString('say "hi"')).toThrow(/Not a valid JSON string literal/);
  });

  it("rejects empty input", () => {
    expect(() => unescapeJsonString("  ")).toThrow(/empty/);
  });
});
