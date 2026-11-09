// Formatter config import: .prettierrc (JSON / YAML / TOML), package.json
// "prettier", .editorconfig, ruff.toml and pyproject.toml [tool.ruff].
//
// `importConfig(text, { filename, format })` detects the format (from the
// file name, else by sniffing the text), parses it (YAML / TOML parsers are
// lazy-loaded) and maps it to a settings patch plus a summary of applied
// and ignored options. It never touches app state: callers merge `patch`
// into the settings. Invalid input throws ConfigImportError.
import { ConfigImportError, isPlainObject } from "./collect.js";
import { mapPackageJson, mapPrettierConfig } from "./prettier.js";
import { mapEditorConfig } from "./editorconfig.js";
import { mapRuffConfig } from "./ruff.js";

export { ConfigImportError } from "./collect.js";

export const CONFIG_FORMATS = [
  { id: "auto", label: "Auto-detect" },
  { id: "prettier", label: ".prettierrc (JSON / YAML / TOML)" },
  { id: "package-json", label: 'package.json ("prettier" key)' },
  { id: "editorconfig", label: ".editorconfig" },
  { id: "ruff", label: "ruff.toml" },
  { id: "pyproject", label: "pyproject.toml [tool.ruff]" },
];

export const MAX_CONFIG_BYTES = 256 * 1024;

export function formatLabel(id) {
  return CONFIG_FORMATS.find((f) => f.id === id)?.label ?? id;
}

function basename(filename) {
  return String(filename ?? "")
    .split(/[\\/]/)
    .pop()
    .toLowerCase();
}

// Format id from a file name, or null when the name says nothing.
export function formatFromFilename(filename) {
  const name = basename(filename);
  if (!name) return null;
  if (name === "package.json") return "package-json";
  if (name === ".editorconfig" || name === "editorconfig") return "editorconfig";
  if (name === "pyproject.toml") return "pyproject";
  if (name === "ruff.toml" || name === ".ruff.toml") return "ruff";
  if (/^\.?prettierrc(\.(json5?|ya?ml|toml))?$/.test(name)) return "prettier";
  if (/^(\.?prettierrc|prettier\.config)\.(c|m)?(j|t)s$/.test(name)) {
    throw new ConfigImportError(
      "JavaScript configs can't be imported. Paste the options as JSON instead."
    );
  }
  return null;
}

// Best guess from the text alone.
export function sniffFormat(text) {
  const t = text.trim();
  if (t.startsWith("{")) {
    try {
      const obj = JSON.parse(t);
      const pkgKeys = ["name", "version", "dependencies", "devDependencies", "scripts"];
      if (isPlainObject(obj) && "prettier" in obj && pkgKeys.some((k) => k in obj)) {
        return "package-json";
      }
    } catch {}
    return "prettier";
  }
  if (/^\s*\[tool\.ruff[\].]/m.test(t)) return "pyproject";
  if (/^\s*\[\*[^\]]*\]/m.test(t) || /^\s*(root|indent_style|indent_size|max_line_length)\s*=/m.test(t)) {
    return "editorconfig";
  }
  if (/^\s*(line-length|indent-width)\s*=/m.test(t) || /^\s*\[(format|lint)\]\s*$/m.test(t)) {
    return "ruff";
  }
  return "prettier";
}

export function detectConfigFormat(text, filename) {
  return formatFromFilename(filename) ?? sniffFormat(text);
}

function parseJson(text, what) {
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new ConfigImportError(`Couldn't parse ${what} as JSON: ${e.message}`);
  }
}

async function parseToml(text, what) {
  const { parse } = await import("smol-toml");
  try {
    return parse(text);
  } catch (e) {
    throw new ConfigImportError(`Couldn't parse ${what} as TOML: ${firstLine(e.message)}`);
  }
}

async function parseYaml(text, what) {
  const { parse } = await import("yaml");
  try {
    return parse(text);
  } catch (e) {
    throw new ConfigImportError(`Couldn't parse ${what} as JSON or YAML: ${firstLine(e.message)}`);
  }
}

function firstLine(msg) {
  return String(msg).split("\n")[0];
}

// .prettierrc may be JSON, YAML or (.prettierrc.toml) TOML.
async function parsePrettierrc(text, filename) {
  const name = basename(filename);
  if (name.endsWith(".toml")) return parseToml(text, ".prettierrc.toml");
  if (name.endsWith(".json") || name.endsWith(".json5")) return parseJson(text, name);
  const t = text.trim();
  if (t.startsWith("{")) {
    try {
      return JSON.parse(t);
    } catch {
      // JSON-ish YAML (or JSON5 with comments) — let the YAML parser try.
    }
  } else if (/^\s*[\w$]+\s*=/m.test(t) && !/^\s*[\w$]+\s*:/m.test(t)) {
    return parseToml(text, ".prettierrc");
  }
  return parseYaml(text, ".prettierrc");
}

function requireObject(value, what) {
  if (!isPlainObject(value)) {
    throw new ConfigImportError(`Expected ${what} to contain a set of options`);
  }
  return value;
}

/**
 * @param {string} text  file contents
 * @param {{ filename?: string, format?: string }} [opts]  format "auto" (default)
 *   detects from the file name, then the text
 * @returns {Promise<{ format: string, patch: object,
 *   applied: Array<{ option, value, setting, settingValue }>,
 *   ignored: Array<{ option, reason }> }>}
 */
export async function importConfig(text, { filename = "", format = "auto" } = {}) {
  if (typeof text !== "string" || !text.trim()) {
    throw new ConfigImportError("Paste a config or choose a file first");
  }
  if (text.length > MAX_CONFIG_BYTES) {
    throw new ConfigImportError("That file is too large to be a formatter config");
  }
  const fmt = format === "auto" ? detectConfigFormat(text, filename) : format;
  let mapped;
  switch (fmt) {
    case "prettier":
      mapped = mapPrettierConfig(requireObject(await parsePrettierrc(text, filename), ".prettierrc"));
      break;
    case "package-json":
      mapped = mapPackageJson(requireObject(parseJson(text, "package.json"), "package.json"));
      break;
    case "editorconfig":
      mapped = mapEditorConfig(text);
      break;
    case "ruff":
      mapped = mapRuffConfig(requireObject(await parseToml(text, "ruff.toml"), "ruff.toml"));
      break;
    case "pyproject":
      mapped = mapRuffConfig(
        requireObject(await parseToml(text, "pyproject.toml"), "pyproject.toml"),
        { pyproject: true }
      );
      break;
    default:
      throw new ConfigImportError(`Unknown config format "${fmt}"`);
  }
  return { format: fmt, ...mapped };
}

// Human-readable value of a setting, shown after its SETTING_LABELS entry
// in the import summary ("Semicolons: off").
export function describeSetting(setting, value) {
  switch (setting) {
    case "indent":
    case "pythonIndent":
      return value === "tab" ? "tabs" : `${value} spaces`;
    case "lineWidth":
    case "pythonLineWidth":
      return `${value} columns`;
    case "quotes":
    case "pythonQuotes":
      return value === "preserve" ? "preserve quotes" : `${value} quotes`;
    case "semi":
    case "bracketSpacing":
      return value ? "on" : "off";
    case "endOfLine":
      return value === "auto" ? "auto" : value.toUpperCase();
    default:
      return String(value);
  }
}

export const SETTING_LABELS = {
  indent: "Indent",
  lineWidth: "Line width",
  quotes: "Quotes",
  semi: "Semicolons",
  trailingComma: "Trailing commas",
  bracketSpacing: "Bracket spacing",
  arrowParens: "Arrow parens",
  proseWrap: "Prose wrap",
  endOfLine: "Line endings",
  pythonIndent: "Python indent",
  pythonLineWidth: "Python line width",
  pythonQuotes: "Python quotes",
};
