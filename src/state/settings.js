import { STORAGE_KEYS } from "./storage.js";

export const DEFAULT_SETTINGS = {
  indent: 2,
  lineWidth: 80,
  quotes: "double",
  editorTheme: "pretty-lush-light",
  autoFormat: false,
  formatOnPaste: false,
  // Ruff lint diagnostics for Python (input editor + problems list).
  lint: false,
};

const DARK_THEME = "pretty-lush-dark";

export function prefersDarkScheme() {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-color-scheme: dark)").matches
  );
}

// Reads persisted settings, merged over defaults. When nothing (or garbage) is
// stored, the default editor theme is migrated from the legacy
// `pretty-lush:theme` light/dark key, falling back to the OS color scheme.
// `prefersDark` is only consulted when that legacy key is absent.
export function loadSettings(storage, prefersDark = prefersDarkScheme) {
  function migratedDefault() {
    try {
      const oldTheme = storage.getItem(STORAGE_KEYS.theme);
      if (oldTheme === "dark")
        return { ...DEFAULT_SETTINGS, editorTheme: DARK_THEME };
      if (oldTheme === "light") return DEFAULT_SETTINGS;
    } catch {}
    if (prefersDark()) return { ...DEFAULT_SETTINGS, editorTheme: DARK_THEME };
    return DEFAULT_SETTINGS;
  }
  try {
    const raw = storage.getItem(STORAGE_KEYS.settings);
    if (!raw) return migratedDefault();
    const parsed = JSON.parse(raw);
    return { ...migratedDefault(), ...parsed };
  } catch {
    return migratedDefault();
  }
}
