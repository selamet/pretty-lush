import { describe, expect, it } from "vitest";
import {
  ID_KINDS,
  MAX_ID_COUNT,
  clampIdCount,
  createUlidGenerator,
  createUuidV7Generator,
  generateIds,
  isUlid,
  isUuid,
  parseUuid,
  ulid,
  ulidTime,
  uuidV7Time,
  uuidv4,
  uuidv7,
} from "./ids.js";

const UUID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ULID_FORMAT = /^[0-7][0-9ABCDEFGHJKMNPQRSTVWXYZ]{25}$/;

// Deterministic "random" source: every byte is `fill`.
const constRandom = (fill) => (n) => new Uint8Array(n).fill(fill);

describe("uuidv4", () => {
  it("is a lowercase RFC 9562 version-4 UUID", () => {
    for (let i = 0; i < 200; i++) {
      const id = uuidv4();
      expect(id).toMatch(UUID_FORMAT);
      expect(id[14]).toBe("4");
      expect("89ab").toContain(id[19]);
      expect(parseUuid(id)).toEqual({ version: 4, variant: "rfc9562" });
    }
  });

  it("is unique", () => {
    const ids = new Set(Array.from({ length: 1000 }, uuidv4));
    expect(ids.size).toBe(1000);
  });
});

describe("uuidv7", () => {
  it("has the RFC 9562 layout: timestamp, version 7, variant 10", () => {
    const before = Date.now();
    const id = uuidv7();
    const after = Date.now();
    expect(id).toMatch(UUID_FORMAT);
    expect(id[14]).toBe("7");
    expect("89ab").toContain(id[19]);
    expect(isUuid(id, 7)).toBe(true);
    const t = uuidV7Time(id);
    expect(t).toBeGreaterThanOrEqual(before);
    expect(t).toBeLessThanOrEqual(after);
  });

  it("encodes the 48-bit millisecond timestamp big-endian", () => {
    const gen = createUuidV7Generator({ now: () => 0x0123456789ab, random: constRandom(0) });
    const id = gen();
    expect(id.startsWith("01234567-89ab-7")).toBe(true);
    expect(uuidV7Time(id)).toBe(0x0123456789ab);
  });

  it("is strictly increasing within the same millisecond", () => {
    const gen = createUuidV7Generator({ now: () => 1_700_000_000_000 });
    const ids = Array.from({ length: 5000 }, gen);
    for (let i = 1; i < ids.length; i++) expect(ids[i] > ids[i - 1]).toBe(true);
    expect(ids.every((id) => isUuid(id, 7))).toBe(true);
  });

  it("stays ordered when the clock goes backwards", () => {
    let t = 2000;
    const gen = createUuidV7Generator({ now: () => t });
    const a = gen();
    t = 1000;
    const b = gen();
    expect(b > a).toBe(true);
    expect(uuidV7Time(b)).toBe(2000);
  });

  it("advances the timestamp when the counter overflows", () => {
    const gen = createUuidV7Generator({ now: () => 5000, random: constRandom(0xff) });
    const ids = Array.from({ length: 4096 }, gen);
    for (let i = 1; i < ids.length; i++) expect(ids[i] > ids[i - 1]).toBe(true);
    expect(uuidV7Time(ids.at(-1))).toBe(5001);
    expect(ids.every((id) => isUuid(id, 7))).toBe(true);
  });

  it("sorts by time across milliseconds", () => {
    let t = 1000;
    const gen = createUuidV7Generator({ now: () => t++ });
    const ids = Array.from({ length: 100 }, gen);
    expect([...ids].sort()).toEqual(ids);
  });
});

describe("ulid", () => {
  it("is 26 Crockford base32 chars with the current timestamp", () => {
    const before = Date.now();
    const id = ulid();
    const after = Date.now();
    expect(id).toMatch(ULID_FORMAT);
    expect(isUlid(id)).toBe(true);
    expect(ulidTime(id)).toBeGreaterThanOrEqual(before);
    expect(ulidTime(id)).toBeLessThanOrEqual(after);
  });

  it("encodes the timestamp like the spec example", () => {
    // ulid spec: 1469918176385 → 01ARYZ6S41
    const gen = createUlidGenerator({ now: () => 1469918176385, random: constRandom(0) });
    expect(gen()).toBe("01ARYZ6S41" + "0".repeat(16));
  });

  it("increments the random part within the same millisecond", () => {
    const gen = createUlidGenerator({ now: () => 1469918176385, random: constRandom(0) });
    expect(gen()).toBe("01ARYZ6S410000000000000000");
    expect(gen()).toBe("01ARYZ6S410000000000000001");
    expect(gen()).toBe("01ARYZ6S410000000000000002");
  });

  it("carries and overflows into the next millisecond", () => {
    const gen = createUlidGenerator({ now: () => 0, random: constRandom(31) });
    const first = gen();
    expect(first).toBe("0000000000ZZZZZZZZZZZZZZZZ");
    const second = gen();
    expect(ulidTime(second)).toBe(1);
    expect(second > first).toBe(true);
  });

  it("is strictly increasing within the same millisecond and across them", () => {
    let t = 1_700_000_000_000;
    let calls = 0;
    const gen = createUlidGenerator({ now: () => (calls++ % 50 === 0 ? ++t : t) });
    const ids = Array.from({ length: 5000 }, gen);
    for (let i = 1; i < ids.length; i++) expect(ids[i] > ids[i - 1]).toBe(true);
    expect(ids.every(isUlid)).toBe(true);
  });

  it("stays ordered when the clock goes backwards", () => {
    let t = 2000;
    const gen = createUlidGenerator({ now: () => t });
    const a = gen();
    t = 1000;
    expect(gen() > a).toBe(true);
  });
});

describe("validation", () => {
  it("parseUuid reads version and variant bits", () => {
    expect(parseUuid("00000000-0000-1000-8000-000000000000")).toEqual({ version: 1, variant: "rfc9562" });
    expect(parseUuid("00000000-0000-4000-c000-000000000000")).toEqual({ version: 4, variant: "microsoft" });
    expect(parseUuid("00000000-0000-4000-0000-000000000000")).toEqual({ version: 4, variant: "ncs" });
    expect(parseUuid("not-a-uuid")).toBeNull();
    expect(parseUuid("00000000-0000-4000-8000-00000000000")).toBeNull();
    expect(parseUuid(null)).toBeNull();
  });

  it("isUuid checks variant and optional version", () => {
    const v4 = uuidv4();
    expect(isUuid(v4)).toBe(true);
    expect(isUuid(v4, 4)).toBe(true);
    expect(isUuid(v4, 7)).toBe(false);
    expect(isUuid("00000000-0000-4000-c000-000000000000")).toBe(false);
  });

  it("isUlid rejects bad length, ambiguous letters and overflowing timestamps", () => {
    expect(isUlid("01ARYZ6S41TSV4RRFFQ69G5FAV")).toBe(true);
    expect(isUlid("01ARYZ6S41TSV4RRFFQ69G5FA")).toBe(false);
    expect(isUlid("01ARYZ6S41TSV4RRFFQ69G5FAI")).toBe(false); // I
    expect(isUlid("01ARYZ6S41TSV4RRFFQ69G5FAU")).toBe(false); // U
    expect(isUlid("81ARYZ6S41TSV4RRFFQ69G5FAV")).toBe(false); // > 2^48
  });

  it("uuidV7Time / ulidTime reject other formats", () => {
    expect(() => uuidV7Time(uuidv4())).toThrow(/v7/);
    expect(() => ulidTime("nope")).toThrow(/ULID/);
  });
});

describe("generateIds", () => {
  it("generates N valid IDs of each kind", () => {
    expect(ID_KINDS.map((k) => k.id)).toEqual(["uuidv4", "uuidv7", "ulid"]);
    expect(generateIds("uuidv4", 5).every((id) => isUuid(id, 4))).toBe(true);
    const v7 = generateIds("uuidv7", 50);
    expect(v7.every((id) => isUuid(id, 7))).toBe(true);
    expect([...v7].sort()).toEqual(v7);
    const ulids = generateIds("ulid", 50);
    expect(ulids.every(isUlid)).toBe(true);
    expect([...ulids].sort()).toEqual(ulids);
  });

  it("clamps the count", () => {
    expect(clampIdCount(0)).toBe(1);
    expect(clampIdCount("abc")).toBe(1);
    expect(clampIdCount(3.9)).toBe(3);
    expect(clampIdCount(10 ** 9)).toBe(MAX_ID_COUNT);
    expect(generateIds("ulid", -4)).toHaveLength(1);
  });

  it("rejects unknown kinds", () => {
    expect(() => generateIds("snowflake")).toThrow(/Unknown ID kind/);
  });
});
