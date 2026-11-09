import { STORAGE_KEYS } from "./storage.js";
import { LANGUAGES, SAMPLES } from "../languages/registry.js";

export const DEFAULT_LANG = "python";
// Per-language inputs larger than this are not persisted (quota safety).
export const MAX_INPUT_BYTES = 100_000;

export function isKnownLang(id) {
  return LANGUAGES.some((l) => l.id === id);
}

// Reads the persisted current language + per-language inputs. Inputs are
// layered over the built-in samples so every language starts with something.
export function loadWorkspace(storage) {
  let state = null;
  try {
    const raw = storage.getItem(STORAGE_KEYS.workspace);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && typeof data === "object") state = data;
    }
  } catch {
    state = null;
  }
  const lang =
    state?.lang && isKnownLang(state.lang) ? state.lang : DEFAULT_LANG;
  const inputs = {
    ...SAMPLES,
    ...(state?.inputs && typeof state.inputs === "object" ? state.inputs : {}),
  };
  return { lang, inputs };
}

// Shape written to storage; oversized inputs are dropped.
export function serializeWorkspace(lang, inputs) {
  const trimmedInputs = {};
  for (const k of Object.keys(inputs)) {
    const v = inputs[k] || "";
    if (v.length <= MAX_INPUT_BYTES) trimmedInputs[k] = v;
  }
  return { lang, inputs: trimmedInputs };
}

// Compare mode A / B bodies.
export function loadCompare(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEYS.compare);
    if (!raw) return { a: "", b: "" };
    const parsed = JSON.parse(raw);
    return { a: parsed?.a || "", b: parsed?.b || "" };
  } catch {
    return { a: "", b: "" };
  }
}
