import { describe, expect, it } from "vitest";
import { isoToTimestamp, timestampToIso } from "./timestamp.js";

describe("timestampToIso", () => {
  it("treats 10-digit input as seconds", () => {
    expect(timestampToIso("1700000000")).toBe("2023-11-14T22:13:20.000Z");
  });

  it("treats 13-digit input as milliseconds and 16-digit as microseconds", () => {
    expect(timestampToIso("1700000000123")).toBe("2023-11-14T22:13:20.123Z");
    expect(timestampToIso("1700000000123456")).toBe("2023-11-14T22:13:20.123Z");
  });

  it("trims whitespace and handles the epoch", () => {
    expect(timestampToIso("  0\n")).toBe("1970-01-01T00:00:00.000Z");
  });

  it("rejects non-integer input", () => {
    expect(() => timestampToIso("12.5")).toThrow("Expected a unix timestamp (integer)");
    expect(() => timestampToIso("-1")).toThrow("Expected a unix timestamp (integer)");
    expect(() => timestampToIso("")).toThrow("Expected a unix timestamp (integer)");
  });

  it("rejects timestamps outside the Date range", () => {
    expect(() => timestampToIso("99999999999999999999")).toThrow("Timestamp out of range");
  });
});

describe("isoToTimestamp", () => {
  it("converts ISO strings to unix seconds (flooring milliseconds)", () => {
    expect(isoToTimestamp("2023-11-14T22:13:20.999Z")).toBe("1700000000");
    expect(isoToTimestamp(" 1970-01-01T00:00:00Z ")).toBe("0");
  });

  it("round-trips with timestampToIso", () => {
    expect(isoToTimestamp(timestampToIso("1700000000"))).toBe("1700000000");
  });

  it("rejects unparseable dates", () => {
    expect(() => isoToTimestamp("not a date")).toThrow("Could not parse as an ISO date");
  });
});
