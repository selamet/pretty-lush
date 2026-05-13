import { b64ToBytes } from "./encoding.js";

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
