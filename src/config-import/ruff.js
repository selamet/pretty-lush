// ruff.toml / pyproject.toml [tool.ruff] → Python (Ruff) overrides.
//
// Only the formatter subset maps: line-length, indent-width and
// [format] indent-style / quote-style. Ruff options never touch the shared
// indent / width / quotes used by Prettier & co.
import {
  ConfigImportError,
  INDENT_WIDTH,
  REASONS,
  createCollector,
  isPlainObject,
  toChoice,
  toInt,
} from "./collect.js";

// Ruff caps line-length at 320.
const RUFF_LINE_LENGTH = [1, 320];

const LINT_KEYS = new Set([
  "select",
  "ignore",
  "extend-select",
  "extend-ignore",
  "fixable",
  "unfixable",
  "per-file-ignores",
  "extend-per-file-ignores",
]);

/**
 * @param {object} doc  parsed TOML document
 * @param {{ pyproject?: boolean }} [opts]  read [tool.ruff] instead of the root
 */
export function mapRuffConfig(doc, { pyproject = false } = {}) {
  let root = doc;
  let prefix = "";
  if (pyproject) {
    root = doc?.tool?.ruff;
    prefix = "tool.ruff.";
    if (!isPlainObject(root)) {
      throw new ConfigImportError("No [tool.ruff] table found in pyproject.toml");
    }
  }
  const c = createCollector();
  const opt = (k) => `${prefix}${k}`;
  const format = isPlainObject(root.format) ? root.format : {};

  for (const [key, value] of Object.entries(root)) {
    if (key === "line-length") {
      const n = toInt(value, ...RUFF_LINE_LENGTH);
      if (n === null) c.ignore(opt(key), REASONS.invalid(value));
      else c.apply(opt(key), value, "pythonLineWidth", n);
    } else if (key === "indent-width") {
      // Mapped together with format.indent-style below.
    } else if (key === "format") {
      if (!isPlainObject(value)) c.ignore(opt(key), REASONS.invalid(value));
    } else if (key === "lint" || LINT_KEYS.has(key)) {
      c.ignore(opt(key), "lint rules are not configurable here");
    } else {
      c.ignore(opt(key), REASONS.unsupported);
    }
  }

  for (const [key, value] of Object.entries(format)) {
    const name = opt(`format.${key}`);
    if (key === "quote-style") {
      const q = toChoice("quotes", value);
      if (q === null) c.ignore(name, REASONS.invalid(value));
      else c.apply(name, value, "pythonQuotes", q);
    } else if (key !== "indent-style") {
      c.ignore(name, REASONS.unsupported);
    }
  }

  mapIndent(root, format, c, opt);
  return c.result();
}

// format.indent-style = "tab" wins over indent-width; "space" uses
// indent-width or Ruff's default of 4.
function mapIndent(root, format, c, opt) {
  const hasWidth = "indent-width" in root;
  const width = hasWidth ? toInt(root["indent-width"], ...INDENT_WIDTH) : null;
  if (hasWidth && width === null) {
    c.ignore(opt("indent-width"), REASONS.invalid(root["indent-width"]));
  }
  const hasStyle = "indent-style" in format;
  const style = format["indent-style"];
  if (hasStyle && style !== "tab" && style !== "space") {
    c.ignore(opt("format.indent-style"), REASONS.invalid(style));
  }
  if (style === "tab") {
    c.apply(opt("format.indent-style"), "tab", "pythonIndent", "tab");
    if (width !== null) c.ignore(opt("indent-width"), "not used with tabs");
  } else if (width !== null) {
    c.apply(opt("indent-width"), root["indent-width"], "pythonIndent", width);
  } else if (style === "space") {
    c.apply(opt("format.indent-style"), "space", "pythonIndent", 4);
  }
}
