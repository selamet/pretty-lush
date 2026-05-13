// Base64 / URL percent / Hex — encode and decode in both directions.

function bytesToB64(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function b64ToBytes(b64) {
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
  // Accept both standard and url-safe base64.
  const std = cleaned.replace(/-/g, "+").replace(/_/g, "/");
  const padded = std + "=".repeat((4 - (std.length % 4)) % 4);
  try {
    return new TextDecoder().decode(b64ToBytes(padded));
  } catch {
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
