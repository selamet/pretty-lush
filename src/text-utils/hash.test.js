import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  HASH_ALGORITHMS,
  digestAll,
  encodeDigest,
  hashText,
  md5Bytes,
  toBase64,
  toHex,
  utf8Bytes,
} from "./hash.js";

const FOX = "The quick brown fox jumps over the lazy dog";

// Published test vectors (RFC 1321, FIPS 180 examples, Wikipedia).
const VECTORS = {
  md5: {
    "": "d41d8cd98f00b204e9800998ecf8427e",
    abc: "900150983cd24fb0d6963f7d28e17f72",
    [FOX]: "9e107d9d372bb6826bd81d3542a419d6",
    "12345678901234567890123456789012345678901234567890123456789012345678901234567890":
      "57edf4a22be3c955ac49da2e2107b67a",
  },
  sha1: {
    "": "da39a3ee5e6b4b0d3255bfef95601890afd80709",
    abc: "a9993e364706816aba3e25717850c26c9cd0d89d",
    [FOX]: "2fd4e1c67a2d28fced849ee1bb76e7391b93eb12",
  },
  sha256: {
    "": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    abc: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    [FOX]: "d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592",
  },
  sha384: {
    "": "38b060a751ac96384cd9327eb1b1e36a21fdb71114be07434c0cc7bf63f6e1da274edebfe76f65fbd51ad2f14898b95b",
    abc: "cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7",
  },
  sha512: {
    "": "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e",
    abc: "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
  },
};

const NODE_NAMES = { md5: "md5", sha1: "sha1", sha256: "sha256", sha384: "sha384", sha512: "sha512" };

describe("hashText", () => {
  for (const [algo, cases] of Object.entries(VECTORS)) {
    for (const [input, expected] of Object.entries(cases)) {
      it(`${algo}(${JSON.stringify(input.slice(0, 20))}) matches the known vector`, async () => {
        expect(await hashText(input, algo)).toBe(expected);
      });
    }
  }

  const samples = [
    "",
    "a",
    "héllo wörld",
    "日本語のテキスト",
    "emoji 🦊🔥 and ZWJ 👩‍💻",
    "x".repeat(55),
    "x".repeat(56),
    "x".repeat(63),
    "x".repeat(64),
    "x".repeat(65),
    "lorem ipsum ".repeat(500),
  ];
  for (const algo of HASH_ALGORITHMS.map((a) => a.id)) {
    it(`${algo} matches node:crypto on unicode and block-boundary inputs`, async () => {
      for (const s of samples) {
        const ref = createHash(NODE_NAMES[algo]).update(s, "utf8").digest();
        expect(await hashText(s, algo)).toBe(ref.toString("hex"));
        expect(await hashText(s, algo, { encoding: "base64" })).toBe(ref.toString("base64"));
      }
    });
  }

  it("rejects unknown algorithms", async () => {
    await expect(hashText("x", "sha3")).rejects.toThrow(/Unknown hash/);
  });
});

describe("digestAll / encoding helpers", () => {
  it("returns a digest per algorithm with the right length", async () => {
    const all = await digestAll(FOX);
    expect(Object.keys(all)).toEqual(HASH_ALGORITHMS.map((a) => a.id));
    expect(all.md5).toHaveLength(16);
    expect(all.sha1).toHaveLength(20);
    expect(all.sha256).toHaveLength(32);
    expect(all.sha384).toHaveLength(48);
    expect(all.sha512).toHaveLength(64);
    expect(encodeDigest(all.md5)).toBe(VECTORS.md5[FOX]);
    expect(encodeDigest(all.md5, "base64")).toBe("nhB9nTcrtoJr2B01QqQZ1g==");
  });

  it("toHex is lowercase and zero-padded; toBase64 is padded", () => {
    expect(toHex(new Uint8Array([0, 10, 255]))).toBe("000aff");
    expect(toBase64(new Uint8Array([0xfb, 0xff]))).toBe("+/8=");
  });

  it("md5Bytes works on raw bytes", () => {
    expect(toHex(md5Bytes(utf8Bytes("abc")))).toBe(VECTORS.md5.abc);
  });

  it("marks MD5 and SHA-1 as insecure", () => {
    const insecure = HASH_ALGORITHMS.filter((a) => a.insecure).map((a) => a.id);
    expect(insecure).toEqual(["md5", "sha1"]);
  });
});
