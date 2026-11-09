import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeJwt } from "./jwt.js";

const b64url = (obj) =>
  Buffer.from(JSON.stringify(obj)).toString("base64url");

const makeJwt = (header, payload, sig = "sig") =>
  `${b64url(header)}.${b64url(payload)}.${sig}`;

describe("decodeJwt", () => {
  afterEach(() => vi.useRealTimers());

  it("decodes header, payload, signature and time metadata", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
    const iat = Date.UTC(2023, 11, 31) / 1000;
    const exp = iat + 3 * 86400;
    const token = makeJwt({ alg: "HS256", typ: "JWT" }, { sub: "42", name: "Zoë", iat, exp }, "abc");

    const out = decodeJwt(`  ${token}\n`);
    expect(out.header).toEqual({ alg: "HS256", typ: "JWT" });
    expect(out.payload).toMatchObject({ sub: "42", name: "Zoë" });
    expect(out.signature).toBe("abc");
    expect(out.meta.issuedAt.toISOString()).toBe("2023-12-31T00:00:00.000Z");
    expect(out.meta.expiresAt.toISOString()).toBe("2024-01-03T00:00:00.000Z");
    expect(out.meta.expired).toBe(false);
    expect(out.meta.lifetimeSec).toBe(3 * 86400);
    expect(out.meta.notBefore).toBeNull();
  });

  it("flags expired tokens", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
    const token = makeJwt({ alg: "none" }, { exp: Date.UTC(2025, 0, 1) / 1000 });
    expect(decodeJwt(token).meta.expired).toBe(true);
  });

  it("leaves time metadata null when claims are absent", () => {
    const { meta } = decodeJwt(makeJwt({ alg: "none" }, { sub: "x" }, ""));
    expect(meta).toEqual({
      issuedAt: null,
      notBefore: null,
      expiresAt: null,
      expired: null,
      lifetimeSec: null,
    });
  });

  it("rejects tokens without three parts", () => {
    expect(() => decodeJwt("a.b")).toThrow("JWT must have three dot-separated parts");
  });

  it("reports which part failed to decode", () => {
    const good = b64url({ a: 1 });
    expect(() => decodeJwt(`!!!.${good}.s`)).toThrow("JWT header is not valid base64url JSON");
    expect(() => decodeJwt(`${good}.bm90IGpzb24.s`)).toThrow("JWT payload is not valid base64url JSON");
  });
});
