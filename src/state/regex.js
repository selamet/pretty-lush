// Persisted Regex tester state: the last pattern, flags and replacement.
// The test text is not stored: it is seeded from the current input.
import { STORAGE_KEYS } from "./storage.js";
import { normalizeFlags } from "../regex/core.js";

// Starter pattern: `key: value` / `key = value` pairs, so it finds something
// in most samples (JSON, YAML, Python keyword arguments, …).
export const DEFAULT_REGEX_STATE = {
  pattern: '"?(?<key>\\w+)"?\\s*[=:]\\s*(?<value>"[^"]*"|[\\w.-]+)',
  flags: "g",
  replacement: "$<key> = $<value>",
};

export function loadRegexState(storage) {
  try {
    const raw = storage?.getItem(STORAGE_KEYS.regex);
    if (!raw) return DEFAULT_REGEX_STATE;
    const parsed = JSON.parse(raw);
    const str = (v, fallback) => (typeof v === "string" ? v : fallback);
    return {
      pattern: str(parsed?.pattern, DEFAULT_REGEX_STATE.pattern),
      flags: normalizeFlags(str(parsed?.flags, DEFAULT_REGEX_STATE.flags)),
      replacement: str(parsed?.replacement, DEFAULT_REGEX_STATE.replacement),
    };
  } catch {
    return DEFAULT_REGEX_STATE;
  }
}
