import { describe, expect, it } from "vitest";
import {
  base64Decode,
  base64Encode,
  hexDecode,
  hexEncode,
  urlDecode,
  urlEncode,
} from "./encoding.js";

describe("base64", () => {
  it("encodes and decodes UTF-8 text", () => {
    expect(base64Encode("hello")).toBe("aGVsbG8=");
    expect(base64Encode("héllo ✓")).toBe("aMOpbGxvIOKckw==");
    expect(base64Decode("aMOpbGxvIOKckw==")).toBe("héllo ✓");
  });

  it("accepts url-safe alphabet, missing padding and whitespace", () => {
    // "??>" -> standard "Pz8+", url-safe "Pz8-"
    expect(base64Decode("Pz8-")).toBe("??>");
    expect(base64Decode("  aGVs\nbG8 ")).toBe("hello");
  });

  it("throws on invalid input", () => {
    expect(() => base64Decode("not base64!!")).toThrow("Input is not valid Base64");
  });
});

describe("url percent-encoding", () => {
  it("round-trips reserved and unicode characters", () => {
    expect(urlEncode("a b&c=d/é")).toBe("a%20b%26c%3Dd%2F%C3%A9");
    expect(urlDecode("a%20b%26c%3Dd%2F%C3%A9")).toBe("a b&c=d/é");
  });

  it("throws on malformed sequences", () => {
    expect(() => urlDecode("%E0%A4%A")).toThrow("Input is not valid percent-encoded text");
  });
});

describe("hex", () => {
  it("encodes and decodes UTF-8 bytes", () => {
    expect(hexEncode("Hi é")).toBe("486920c3a9");
    expect(hexDecode("486920c3a9")).toBe("Hi é");
  });

  it("tolerates a 0x prefix, whitespace, colons and uppercase", () => {
    expect(hexDecode("0x48 69:21")).toBe("Hi!");
    expect(hexDecode("4869")).toBe(hexDecode("4869".toUpperCase()));
  });

  it("rejects odd-length and non-hex input", () => {
    expect(() => hexDecode("abc")).toThrow("Input is not a valid hex string");
    expect(() => hexDecode("zz")).toThrow("Input is not a valid hex string");
  });
});
