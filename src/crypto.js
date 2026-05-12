// Client-side encryption for shared pastes.
// AES-GCM 256-bit. Random key, never sent to the server.
// If the user provides a password, an additional key is derived via PBKDF2
// and combined with the random key, so a leaked URL alone cannot decrypt.

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();

function b64uEncode(bytes) {
  let bin = "";
  const view = new Uint8Array(bytes);
  for (const b of view) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64uDecode(s) {
  let b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKeyFromPassword(password, salt) {
  const baseKey = await subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 250_000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

async function generateRandomKey() {
  return subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

async function exportRawKey(key) {
  const buf = await subtle.exportKey("raw", key);
  return new Uint8Array(buf);
}

async function importRawKey(bytes) {
  return subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

// XOR two equal-length byte arrays (used to combine random key with password-derived key)
function xorBytes(a, b) {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i];
  return out;
}

/**
 * Encrypt plaintext. Returns:
 *   { ciphertext, iv, salt?, urlKey, hasPassword }
 * urlKey is the base64url key fragment that goes into the URL hash.
 * salt is only present when a password is supplied.
 */
export async function encryptShare(plaintext, password = null) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const randomKey = await generateRandomKey();

  let effectiveKey = randomKey;
  let salt = null;

  if (password) {
    salt = crypto.getRandomValues(new Uint8Array(16));
    const passKey = await deriveKeyFromPassword(password, salt);
    const rawRandom = await exportRawKey(randomKey);
    const rawPass = await exportRawKey(passKey);
    const combined = xorBytes(rawRandom, rawPass);
    effectiveKey = await importRawKey(combined);
  }

  const data = enc.encode(plaintext);
  const cipherBuf = await subtle.encrypt(
    { name: "AES-GCM", iv },
    effectiveKey,
    data
  );

  const rawRandomBytes = await exportRawKey(randomKey);

  return {
    ciphertext: b64uEncode(cipherBuf),
    iv: b64uEncode(iv),
    salt: salt ? b64uEncode(salt) : null,
    hasPassword: !!password,
    urlKey: b64uEncode(rawRandomBytes),
  };
}

/**
 * Decrypt. Throws on failure (wrong password, tampered data, etc).
 */
export async function decryptShare({ ciphertext, iv, salt, hasPassword, urlKey, password }) {
  const ivBytes = b64uDecode(iv);
  const cipherBytes = b64uDecode(ciphertext);
  const keyBytes = b64uDecode(urlKey);

  let effectiveKey;
  if (hasPassword) {
    if (!password) throw new Error("Password required");
    if (!salt) throw new Error("Missing salt");
    const saltBytes = b64uDecode(salt);
    const passKey = await deriveKeyFromPassword(password, saltBytes);
    const rawPass = await exportRawKey(passKey);
    const combined = xorBytes(keyBytes, rawPass);
    effectiveKey = await importRawKey(combined);
  } else {
    effectiveKey = await importRawKey(keyBytes);
  }

  try {
    const plainBuf = await subtle.decrypt(
      { name: "AES-GCM", iv: ivBytes },
      effectiveKey,
      cipherBytes
    );
    return dec.decode(plainBuf);
  } catch (e) {
    throw new Error(hasPassword ? "Wrong password or corrupted data" : "Corrupted data");
  }
}
