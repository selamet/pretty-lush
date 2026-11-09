import { STORAGE_KEYS } from "./storage.js";

export const DEFAULT_SETTINGS = {
  indent: 2,
  lineWidth: 80,
  quotes: "double",
  // Prettier-only options (JS / TS / CSS / Markdown / …); defaults match
  // Prettier 3 so existing output does not change.
  semi: true,
  trailingComma: "all",
  bracketSpacing: true,
  arrowParens: "always",
  proseWrap: "preserve",
  endOfLine: "lf",
  // Python (Ruff) overrides, usually from an imported ruff.toml /
  // pyproject.toml. null means "use indent / lineWidth / quotes above".
  pythonIndent: null,
  pythonLineWidth: null,
  pythonQuotes: null,
  editorTheme: "pretty-lush-light",
  autoFormat: false,
  formatOnPaste: false,
  // Ruff lint diagnostics for Python (input editor + problems list).
  lint: false,
};

// Allowed values of the enum-like settings (also used to validate imported
// formatter configs).
export const SETTING_CHOICES = {
  quotes: ["double", "single", "preserve"],
  trailingComma: ["all", "es5", "none"],
  arrowParens: ["always", "avoid"],
  proseWrap: ["preserve", "always", "never"],
  endOfLine: ["lf", "crlf", "cr", "auto"],
};

// Settings that shape formatter output. These are what a settings profile
// stores and what auto-format reacts to; editor theme and behaviour toggles
// (auto-format, format on paste, lint) stay global.
export const FORMAT_SETTING_KEYS = [
  "indent",
  "lineWidth",
  "quotes",
  "semi",
  "trailingComma",
  "bracketSpacing",
  "arrowParens",
  "proseWrap",
  "endOfLine",
  "pythonIndent",
  "pythonLineWidth",
  "pythonQuotes",
];

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
