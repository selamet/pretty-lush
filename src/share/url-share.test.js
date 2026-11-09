import { describe, expect, it } from "vitest";
import { decodeShare, encodeShare } from "./url-share.js";

describe("url-share", () => {
  it("round-trips a state object, including unicode", () => {
    const state = { lang: "python", code: "print('héllo ✓ 🚀')\n", indent: 4 };
    expect(decodeShare(encodeShare(state))).toEqual(state);
  });

  it("produces a url-safe, unpadded fragment", () => {
    // Enough varied bytes to exercise '+', '/' and '=' in standard base64.
    const hash = encodeShare({ code: "?>?>~~~ÿþ".repeat(10), n: 1 });
    expect(hash).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("returns null for garbage or non-JSON input", () => {
    expect(decodeShare("%%%not-base64%%%")).toBeNull();
    expect(decodeShare("aGVsbG8")).toBeNull(); // "hello" — valid base64, not JSON
    expect(decodeShare("")).toBeNull();
  });
});
