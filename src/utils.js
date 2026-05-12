// Pure text transforms used by the ⌘K palette. Each takes a string
// and returns a string, or throws an Error with a human message.

function splitLines(src) {
  return src.replace(/\r\n?/g, "\n").split("\n");
}

function joinLines(lines, trailing) {
  return lines.join("\n") + (trailing ? "\n" : "");
}

function hasTrailingNl(src) {
  return src.endsWith("\n");
}

export function sortLines(src, { reverse = false, caseInsensitive = true } = {}) {
  const lines = splitLines(src);
  const sorted = [...lines].sort((a, b) => {
    const av = caseInsensitive ? a.toLowerCase() : a;
    const bv = caseInsensitive ? b.toLowerCase() : b;
    if (av < bv) return -1;
    if (av > bv) return 1;
    return 0;
  });
  if (reverse) sorted.reverse();
  return joinLines(sorted, hasTrailingNl(src));
}

export function dedupeLines(src, { keepBlank = true } = {}) {
  const lines = splitLines(src);
  const seen = new Set();
  const out = [];
  for (const l of lines) {
    if (l === "" && keepBlank) {
      out.push(l);
      continue;
    }
    if (!seen.has(l)) {
      seen.add(l);
      out.push(l);
    }
  }
  return joinLines(out, hasTrailingNl(src));
}

export function reverseLines(src) {
  const lines = splitLines(src);
  // preserve trailing empty line slot if input ended with \n
  const trailing = hasTrailingNl(src);
  if (trailing && lines[lines.length - 1] === "") lines.pop();
  lines.reverse();
  return joinLines(lines, trailing);
}

export function trimEachLine(src) {
  return joinLines(
    splitLines(src).map((l) => l.replace(/[ \t]+$/, "")),
    hasTrailingNl(src)
  );
}

export function collapseBlankLines(src) {
  return splitLines(src)
    .reduce((acc, l) => {
      const lastBlank = acc.length > 0 && acc[acc.length - 1] === "";
      if (l === "" && lastBlank) return acc;
      acc.push(l);
      return acc;
    }, [])
    .join("\n") + (hasTrailingNl(src) ? "\n" : "");
}

export function toUpperCase(src) {
  return src.toUpperCase();
}

export function toLowerCase(src) {
  return src.toLowerCase();
}

export function toTitleCase(src) {
  return src.replace(
    /\b\w[\w']*/g,
    (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()
  );
}

// ── encoding ────────────────────────────────────────
function bytesToB64(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function base64Encode(src) {
  return bytesToB64(new TextEncoder().encode(src));
}

export function base64Decode(src) {
  const cleaned = src.trim().replace(/\s+/g, "");
  // accept both standard and url-safe base64
  const std = cleaned.replace(/-/g, "+").replace(/_/g, "/");
  const padded = std + "=".repeat((4 - (std.length % 4)) % 4);
  try {
    return new TextDecoder().decode(b64ToBytes(padded));
  } catch (e) {
    throw new Error("Input is not valid Base64");
  }
}

export function urlEncode(src) {
  return encodeURIComponent(src);
}

export function urlDecode(src) {
  try {
    return decodeURIComponent(src.trim());
  } catch {
    throw new Error("Input is not valid percent-encoded text");
  }
}

export function hexEncode(src) {
  const bytes = new TextEncoder().encode(src);
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

export function hexDecode(src) {
  const cleaned = src.trim().replace(/^0x/, "").replace(/[\s:]+/g, "");
  if (!/^[0-9a-fA-F]*$/.test(cleaned) || cleaned.length % 2 !== 0)
    throw new Error("Input is not a valid hex string");
  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  }
  return new TextDecoder().decode(bytes);
}

// ── JWT ─────────────────────────────────────────────
function b64uDecodeToString(part) {
  let s = part.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return new TextDecoder().decode(b64ToBytes(s));
}

export function decodeJwt(src) {
  const trimmed = src.trim();
  const parts = trimmed.split(".");
  if (parts.length !== 3)
    throw new Error("JWT must have three dot-separated parts");
  let header;
  let payload;
  try {
    header = JSON.parse(b64uDecodeToString(parts[0]));
  } catch {
    throw new Error("JWT header is not valid base64url JSON");
  }
  try {
    payload = JSON.parse(b64uDecodeToString(parts[1]));
  } catch {
    throw new Error("JWT payload is not valid base64url JSON");
  }
  const now = Math.floor(Date.now() / 1000);
  const exp = typeof payload.exp === "number" ? payload.exp : null;
  const iat = typeof payload.iat === "number" ? payload.iat : null;
  const nbf = typeof payload.nbf === "number" ? payload.nbf : null;
  return {
    header,
    payload,
    signature: parts[2],
    meta: {
      issuedAt: iat ? new Date(iat * 1000) : null,
      notBefore: nbf ? new Date(nbf * 1000) : null,
      expiresAt: exp ? new Date(exp * 1000) : null,
      expired: exp ? exp < now : null,
      lifetimeSec: exp && iat ? exp - iat : null,
    },
  };
}

// ── timestamps ──────────────────────────────────────
export function timestampToIso(src) {
  const t = src.trim();
  if (!/^\d+$/.test(t)) throw new Error("Expected a unix timestamp (integer)");
  const n = Number(t);
  // Heuristic: 10 digits = seconds, 13 = milliseconds, 16 = microseconds
  let ms;
  if (t.length >= 16) ms = Math.floor(n / 1000);
  else if (t.length >= 13) ms = n;
  else ms = n * 1000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) throw new Error("Timestamp out of range");
  return d.toISOString();
}

export function isoToTimestamp(src) {
  const d = new Date(src.trim());
  if (Number.isNaN(d.getTime()))
    throw new Error("Could not parse as an ISO date");
  return String(Math.floor(d.getTime() / 1000));
}
