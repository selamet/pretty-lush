// Message digests of text (UTF-8 bytes). SHA-* use Web Crypto
// (`crypto.subtle`, async; available in browsers on secure origins and in
// Node ≥ 19 as `globalThis.crypto`); MD5 isn't in Web Crypto, so it is a
// small pure implementation (RFC 1321) below.

// Order here is the order of the rows in the Hash modal. `insecure` marks
// algorithms that are broken for collision resistance — fine for checksums
// and cache keys, not for signatures or passwords.
export const HASH_ALGORITHMS = [
  { id: "md5", label: "MD5", insecure: true },
  { id: "sha1", label: "SHA-1", subtle: "SHA-1", insecure: true },
  { id: "sha256", label: "SHA-256", subtle: "SHA-256" },
  { id: "sha384", label: "SHA-384", subtle: "SHA-384" },
  { id: "sha512", label: "SHA-512", subtle: "SHA-512" },
];

const encoder = new TextEncoder();

export function utf8Bytes(text) {
  return encoder.encode(text);
}

/** Lowercase hex of a byte array. */
export function toHex(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

/** Standard (padded) base64 of a byte array. */
export function toBase64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function encodeDigest(bytes, encoding = "hex") {
  return encoding === "base64" ? toBase64(bytes) : toHex(bytes);
}

// ── MD5 (RFC 1321) ─────────────────────────────────────────────────────

// Per-round left-rotate amounts.
const S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

// K[i] = floor(abs(sin(i + 1)) * 2^32).
const K = Array.from({ length: 64 }, (_, i) =>
  Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0
);

/** MD5 digest (16 bytes) of a byte array. */
export function md5Bytes(input) {
  const len = input.length;
  // Message + 0x80 + zero padding to 56 mod 64 + 64-bit little-endian bit length.
  const padded = new Uint8Array(((len + 8) >>> 6) * 64 + 64);
  padded.set(input);
  padded[len] = 0x80;
  const view = new DataView(padded.buffer);
  const bitLen = len * 8;
  view.setUint32(padded.length - 8, bitLen >>> 0, true);
  view.setUint32(padded.length - 4, Math.floor(bitLen / 2 ** 32), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;
  const M = new Uint32Array(16);

  for (let off = 0; off < padded.length; off += 64) {
    for (let j = 0; j < 16; j++) M[j] = view.getUint32(off + j * 4, true);
    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;
    for (let i = 0; i < 64; i++) {
      let F;
      let g;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) & 15;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) & 15;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) & 15;
      }
      F = (F + A + K[i] + M[g]) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) >>> 0;
    }
    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const out = new Uint8Array(16);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, a0, true);
  outView.setUint32(4, b0, true);
  outView.setUint32(8, c0, true);
  outView.setUint32(12, d0, true);
  return out;
}

// ── public API ─────────────────────────────────────────────────────────

/**
 * Digest bytes of `text` (UTF-8) with the algorithm `id` from HASH_ALGORITHMS.
 * @returns {Promise<Uint8Array>}
 */
export async function digestText(text, id) {
  const algo = HASH_ALGORITHMS.find((a) => a.id === id);
  if (!algo) throw new Error(`Unknown hash algorithm: ${id}`);
  const bytes = utf8Bytes(text);
  if (id === "md5") return md5Bytes(bytes);
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto is unavailable (needs HTTPS or localhost)");
  }
  return new Uint8Array(await subtle.digest(algo.subtle, bytes));
}

/**
 * Hash of `text` as a string — lowercase hex (default) or base64.
 * @param {string} text
 * @param {string} id  algorithm id ("md5", "sha1", "sha256", "sha384", "sha512")
 * @param {{ encoding?: "hex"|"base64" }} [opts]
 */
export async function hashText(text, id, { encoding = "hex" } = {}) {
  return encodeDigest(await digestText(text, id), encoding);
}

/**
 * Digests of `text` for every algorithm, as `{ [id]: Uint8Array }`.
 * Encode with `encodeDigest` so switching hex / base64 doesn't re-hash.
 */
export async function digestAll(text) {
  const entries = await Promise.all(
    HASH_ALGORITHMS.map(async (a) => [a.id, await digestText(text, a.id)])
  );
  return Object.fromEntries(entries);
}
