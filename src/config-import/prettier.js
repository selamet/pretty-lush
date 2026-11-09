// Prettier options (from .prettierrc / package.json "prettier" / …) →
// pretty-lush settings.
import {
  INDENT_WIDTH,
  LINE_WIDTH,
  REASONS,
  createCollector,
  isPlainObject,
  toBool,
  toChoice,
  toInt,
} from "./collect.js";

const ENUM_OPTIONS = ["trailingComma", "arrowParens", "proseWrap", "endOfLine"];
const BOOL_OPTIONS = ["semi", "bracketSpacing"];

// Real Prettier options pretty-lush does not expose.
const UNSUPPORTED = new Set([
  "jsxSingleQuote",
  "quoteProps",
  "bracketSameLine",
  "jsxBracketSameLine",
  "htmlWhitespaceSensitivity",
  "vueIndentScriptAndStyle",
  "embeddedLanguageFormatting",
  "singleAttributePerLine",
  "experimentalTernaries",
  "experimentalOperatorPosition",
  "objectWrap",
  "insertPragma",
  "requirePragma",
  "rangeStart",
  "rangeEnd",
  "parser",
  "filepath",
]);

const SPECIAL_REASONS = {
  overrides: "per-file overrides are not supported",
  plugins: "plugins can't be loaded in the browser",
};

// Silently skipped: editor metadata, not formatting options.
const SKIPPED = new Set(["$schema"]);

/**
 * @param {object} config  parsed Prettier config object
 * @returns {{ patch: object, applied: object[], ignored: object[] }}
 */
export function mapPrettierConfig(config) {
  const c = createCollector();
  for (const [key, value] of Object.entries(config)) {
    if (SKIPPED.has(key)) continue;
    if (key === "printWidth") {
      const n = toInt(value, ...LINE_WIDTH);
      if (n === null) c.ignore(key, REASONS.invalid(value));
      else c.apply(key, value, "lineWidth", n);
    } else if (key === "singleQuote") {
      const b = toBool(value);
      if (b === null) c.ignore(key, REASONS.invalid(value));
      else c.apply(key, value, "quotes", b ? "single" : "double");
    } else if (BOOL_OPTIONS.includes(key)) {
      const b = toBool(value);
      if (b === null) c.ignore(key, REASONS.invalid(value));
      else c.apply(key, value, key, b);
    } else if (ENUM_OPTIONS.includes(key)) {
      const v = toChoice(key, value);
      if (v === null) c.ignore(key, REASONS.invalid(value));
      else c.apply(key, value, key, v);
    } else if (key === "useTabs" || key === "tabWidth") {
      // Handled together below.
    } else if (key in SPECIAL_REASONS) {
      c.ignore(key, SPECIAL_REASONS[key]);
    } else if (UNSUPPORTED.has(key)) {
      c.ignore(key, REASONS.unsupported);
    } else {
      c.ignore(key, REASONS.unknown);
    }
  }
  mapIndent(config, c);
  return c.result();
}

// useTabs wins over tabWidth. `useTabs: false` without tabWidth means
// Prettier's default of 2 spaces.
function mapIndent(config, c) {
  const hasTabs = "useTabs" in config;
  const hasWidth = "tabWidth" in config;
  const useTabs = hasTabs ? toBool(config.useTabs) : null;
  const width = hasWidth ? toInt(config.tabWidth, ...INDENT_WIDTH) : null;
  if (hasTabs && useTabs === null) c.ignore("useTabs", REASONS.invalid(config.useTabs));
  if (hasWidth && width === null) c.ignore("tabWidth", REASONS.invalid(config.tabWidth));

  if (useTabs === true) {
    c.apply("useTabs", true, "indent", "tab");
    if (width !== null) c.ignore("tabWidth", "not used while useTabs is on");
  } else if (width !== null) {
    c.apply("tabWidth", config.tabWidth, "indent", width);
  } else if (useTabs === false) {
    c.apply("useTabs", false, "indent", 2);
  }
}

// package.json: options live under "prettier"; a string there names a
// shareable config package, which can't be resolved in the browser.
export function mapPackageJson(pkg) {
  const p = pkg.prettier;
  if (p === undefined) {
    return {
      patch: {},
      applied: [],
      ignored: [{ option: "prettier", reason: 'no "prettier" key in package.json' }],
    };
  }
  if (typeof p === "string") {
    return {
      patch: {},
      applied: [],
      ignored: [{ option: "prettier", reason: `shared config "${p}" can't be resolved` }],
    };
  }
  if (!isPlainObject(p)) {
    return {
      patch: {},
      applied: [],
      ignored: [{ option: "prettier", reason: REASONS.invalid(p) }],
    };
  }
  return mapPrettierConfig(p);
}
