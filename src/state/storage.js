// localStorage keys and safe read/write helpers.
//
// The key strings are part of the public contract with existing users: never
// rename them, or people lose their settings / history on the next visit.
// Bump the `:vN` suffix (and migrate) only when a stored shape changes.
export const STORAGE_KEYS = {
  workspace: "pretty-lush:state:v1",
  layout: "pretty-lush:layout:v1",
  theme: "pretty-lush:theme",
  settings: "pretty-lush:settings:v1",
  history: "pretty-lush:history:v1",
  compare: "pretty-lush:compare:v1",
  schema: "pretty-lush:schema:v1",
  regex: "pretty-lush:regex:v1",
};

// Returns the browser's localStorage, or null when it is unavailable (SSR,
// tests, or browsers that throw on access when storage is blocked). Loaders
// treat a null storage like an empty one.
export function getStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

// Writes a JSON-serialized value, swallowing quota / access errors.
export function writeJSON(key, value) {
  try {
    getStorage().setItem(key, JSON.stringify(value));
  } catch {}
}

// Writes a raw string value, swallowing quota / access errors.
export function writeText(key, text) {
  try {
    getStorage().setItem(key, text);
  } catch {}
}
