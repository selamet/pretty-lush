// Storage adapter for encrypted pastes.
// Uses Vercel KV (Upstash Redis under the hood) when env vars are set,
// otherwise falls back to an in-memory Map so local dev works without setup.
// In production-without-KV, the API surfaces a clear 503 instead of crashing.

const hasKvEnv =
  !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;

let backend = null;
let backendKind = null;
let initError = null;

async function init() {
  if (backend) return;

  if (hasKvEnv) {
    try {
      const mod = await import("@vercel/kv");
      backend = mod.kv;
      backendKind = "kv";
    } catch (e) {
      initError = e;
    }
    return;
  }

  if (process.env.VERCEL) {
    // Deployed without KV — surface a 503 from the handler, no fallback.
    return;
  }

  // Local / no env: in-memory store, TTL-aware.
  const map = new Map();
  backend = {
    async get(key) {
      const entry = map.get(key);
      if (!entry) return null;
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        map.delete(key);
        return null;
      }
      return entry.value;
    },
    async set(key, value, opts = {}) {
      const ttlSec = opts.ex ?? null;
      map.set(key, {
        value,
        expiresAt: ttlSec ? Date.now() + ttlSec * 1000 : null,
      });
    },
    async del(key) {
      map.delete(key);
    },
  };
  backendKind = "memory";
}

export async function getStore() {
  await init();
  if (!backend) {
    const reason = initError
      ? `KV import failed: ${initError.message}`
      : "Encrypted share is not configured on this deployment. Set KV_REST_API_URL and KV_REST_API_TOKEN.";
    const err = new Error(reason);
    err.code = "STORE_UNAVAILABLE";
    throw err;
  }
  return { store: backend, kind: backendKind };
}
