import { describe, expect, it } from "vitest";
import { CURL_TARGETS, convertCurl, getCurlTarget, looksLikeCurl } from "./index.js";

describe("curl index", () => {
  it("has a highlight language and filename per target", () => {
    expect(CURL_TARGETS.map((t) => [t.id, t.lang, t.filename])).toEqual([
      ["fetch", "javascript", "request.js"],
      ["axios", "javascript", "request.js"],
      ["requests", "python", "request.py"],
    ]);
    expect(getCurlTarget("nope").id).toBe("fetch");
  });

  it("detects cURL commands", () => {
    expect(looksLikeCurl("curl https://a.io")).toBe(true);
    expect(looksLikeCurl("  $ curl -sL x")).toBe(true);
    expect(looksLikeCurl("curl.exe ^\"https://a.io^\"")).toBe(true);
    expect(looksLikeCurl("curly braces")).toBe(false);
    expect(looksLikeCurl("curl")).toBe(false);
    expect(looksLikeCurl("echo curl x")).toBe(false);
    expect(looksLikeCurl(undefined)).toBe(false);
  });

  it("converts for every target and returns warnings", () => {
    for (const t of CURL_TARGETS) {
      const r = convertCurl(t.id, "curl --nope https://a.io");
      expect(r.code).toContain("https://a.io");
      expect(r.warnings).toEqual(["Unsupported option --nope ignored"]);
    }
  });

  it("throws FormatError for bad input", () => {
    expect(() => convertCurl("fetch", "curl 'x")).toThrow(/Unterminated/);
  });
});
