import { getStore } from "./_store.js";

const MAX_CIPHERTEXT_BYTES = 700_000; // ~500 KB plain * base64 overhead
const TTL_MIN = 60 * 60; // 1 hour
const TTL_MAX = 60 * 60 * 24 * 30; // 30 days
const TTL_DEFAULT = 60 * 60 * 24 * 7; // 7 days

const ID_ALPHABET =
  "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function makeId(len = 8) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ID_ALPHABET[b % ID_ALPHABET.length];
  return out;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let store;
  try {
    ({ store } = await getStore());
  } catch (e) {
    return res.status(503).json({
      error: e.message,
      code: e.code || "STORE_UNAVAILABLE",
    });
  }

  const { ciphertext, iv, salt, hasPassword, lang, ttl, burnAfterRead } =
    req.body || {};

  if (typeof ciphertext !== "string" || !ciphertext)
    return res.status(400).json({ error: "ciphertext required" });
  if (typeof iv !== "string" || !iv)
    return res.status(400).json({ error: "iv required" });
  if (typeof lang !== "string" || !lang)
    return res.status(400).json({ error: "lang required" });
  if (ciphertext.length > MAX_CIPHERTEXT_BYTES)
    return res.status(413).json({ error: "Content too large (max ~500 KB)" });

  const ttlSec = Math.min(
    TTL_MAX,
    Math.max(TTL_MIN, Number(ttl) || TTL_DEFAULT)
  );

  let id;
  for (let i = 0; i < 5; i++) {
    id = makeId(8);
    const exists = await store.get(`p:${id}`);
    if (!exists) break;
    if (i === 4) return res.status(500).json({ error: "could not allocate id" });
  }

  const record = {
    ciphertext,
    iv,
    salt: salt || null,
    hasPassword: !!hasPassword,
    burnAfterRead: !!burnAfterRead,
    lang,
    createdAt: Date.now(),
  };

  await store.set(`p:${id}`, record, { ex: ttlSec });
  res.setHeader("Cache-Control", "no-store");
  return res.status(201).json({ id, ttl: ttlSec });
}
