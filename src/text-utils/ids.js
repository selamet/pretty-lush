// Unique ID generators: UUID v4 (random), UUID v7 (Unix-ms timestamp
// ordered, RFC 9562 §5.7) and ULID (https://github.com/ulid/spec), plus
// validators. v7 and ULID are monotonic: IDs from one generator sort in
// creation order even within the same millisecond.

function randomBytes(n) {
  const bytes = new Uint8Array(n);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

function hex(bytes) {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

function formatUuid(bytes) {
  const h = hex(bytes);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ── UUID v4 ────────────────────────────────────────────────────────────

/** Random UUID v4 (lowercase). */
export function uuidv4() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  // randomUUID is secure-context only; getRandomValues is not.
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  return formatUuid(b);
}

// ── UUID v7 ────────────────────────────────────────────────────────────

/**
 * Creates a UUID v7 generator. Layout (RFC 9562 §5.7):
 *   48-bit unix_ts_ms | 4-bit ver (0111) | 12-bit rand_a |
 *   2-bit var (10) | 62-bit rand_b
 * rand_a is used as a monotonic counter (RFC 9562 §6.2, method 1): seeded
 * randomly with its top bit clear on each new millisecond, incremented
 * within the same millisecond (or if the clock goes backwards); on
 * overflow the timestamp is advanced by 1 ms.
 *
 * `now` and `random` are injectable for tests.
 */
export function createUuidV7Generator({
  now = () => Date.now(),
  random = randomBytes,
} = {}) {
  let lastMs = -1;
  let counter = 0;
  return function uuidv7() {
    let ms = now();
    const rnd = random(10);
    if (ms > lastMs) {
      counter = ((rnd[0] & 0x07) << 8) | rnd[1]; // 11 random bits
    } else {
      ms = lastMs;
      counter++;
      if (counter > 0xfff) {
        ms++;
        counter = ((rnd[0] & 0x07) << 8) | rnd[1];
      }
    }
    lastMs = ms;

    const b = new Uint8Array(16);
    // 48-bit big-endian timestamp (split: > 2^32 can't use bit ops).
    const hi = Math.floor(ms / 2 ** 32);
    const lo = ms >>> 0;
    b[0] = (hi >>> 8) & 0xff;
    b[1] = hi & 0xff;
    b[2] = (lo >>> 24) & 0xff;
    b[3] = (lo >>> 16) & 0xff;
    b[4] = (lo >>> 8) & 0xff;
    b[5] = lo & 0xff;
    b[6] = 0x70 | (counter >>> 8);
    b[7] = counter & 0xff;
    b[8] = 0x80 | (rnd[2] & 0x3f);
    for (let i = 9; i < 16; i++) b[i] = rnd[i - 6];
    return formatUuid(b);
  };
}

export const uuidv7 = createUuidV7Generator();

// ── ULID ───────────────────────────────────────────────────────────────

export const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const MAX_ULID_TIME = 2 ** 48 - 1;

/**
 * Creates a ULID generator: 10 chars of 48-bit ms timestamp + 16 chars of
 * 80-bit randomness, Crockford base32 (uppercase). Monotonic: within the
 * same millisecond (or if the clock goes backwards) the previous random
 * part is incremented by 1; if that overflows, the timestamp is advanced
 * by 1 ms with fresh randomness (instead of the spec's error).
 */
export function createUlidGenerator({
  now = () => Date.now(),
  random = randomBytes,
} = {}) {
  let lastMs = -1;
  let lastRand = null; // 16 base32 digits (0–31)

  function freshRandom() {
    // 16 random bytes, 5 bits used from each → 80 bits.
    return Array.from(random(16), (b) => b & 31);
  }

  return function ulid() {
    let ms = now();
    if (ms > lastMs || !lastRand) {
      lastRand = freshRandom();
    } else {
      ms = lastMs;
      let i = 15;
      while (i >= 0 && lastRand[i] === 31) lastRand[i--] = 0;
      if (i < 0) {
        ms++;
        lastRand = freshRandom();
      } else {
        lastRand[i]++;
      }
    }
    if (ms > MAX_ULID_TIME) throw new Error("ULID timestamp out of range");
    lastMs = ms;

    let time = "";
    let t = ms;
    for (let i = 0; i < 10; i++) {
      time = CROCKFORD[t % 32] + time;
      t = Math.floor(t / 32);
    }
    return time + lastRand.map((d) => CROCKFORD[d]).join("");
  };
}

export const ulid = createUlidGenerator();

// ── registry ───────────────────────────────────────────────────────────

// ID kinds offered in the UI. Order is the order in the generator modal.
export const ID_KINDS = [
  { id: "uuidv4", label: "UUID v4", generate: () => uuidv4() },
  { id: "uuidv7", label: "UUID v7", generate: () => uuidv7() },
  { id: "ulid", label: "ULID", generate: () => ulid() },
];

export const MAX_ID_COUNT = 1000;

/** `count` IDs of `kind` (an ID_KINDS id); count is clamped to 1…MAX_ID_COUNT. */
export function generateIds(kind, count = 1) {
  const k = ID_KINDS.find((x) => x.id === kind);
  if (!k) throw new Error(`Unknown ID kind: ${kind}`);
  const n = clampIdCount(count);
  return Array.from({ length: n }, () => k.generate());
}

export function clampIdCount(count) {
  const n = Math.floor(Number(count));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_ID_COUNT);
}

// ── validation ─────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ULID_RE = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/i;

/**
 * Parses an RFC 9562 UUID string. Returns `{ version, variant }` or null
 * when the string isn't a UUID; `variant` is "rfc9562" for the 10xx
 * variant bits.
 */
export function parseUuid(s) {
  if (typeof s !== "string" || !UUID_RE.test(s)) return null;
  const version = parseInt(s[14], 16);
  const v = parseInt(s[19], 16);
  const variant =
    (v & 0b1000) === 0 ? "ncs" : (v & 0b0100) === 0 ? "rfc9562" : (v & 0b0010) === 0 ? "microsoft" : "future";
  return { version, variant };
}

/** True for a UUID with RFC 9562 variant bits (and `version`, if given). */
export function isUuid(s, version) {
  const p = parseUuid(s);
  if (!p || p.variant !== "rfc9562") return false;
  return version == null || p.version === version;
}

/** Unix ms timestamp embedded in a UUID v7. */
export function uuidV7Time(s) {
  if (!isUuid(s, 7)) throw new Error("Not a UUID v7");
  return parseInt(s.replace(/-/g, "").slice(0, 12), 16);
}

export function isUlid(s) {
  return typeof s === "string" && ULID_RE.test(s);
}

/** Unix ms timestamp embedded in a ULID. */
export function ulidTime(s) {
  if (!isUlid(s)) throw new Error("Not a ULID");
  let t = 0;
  for (const ch of s.slice(0, 10).toUpperCase()) t = t * 32 + CROCKFORD.indexOf(ch);
  return t;
}
