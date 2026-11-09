// .editorconfig → pretty-lush settings.
//
// Only sections that apply to every file (`[*]`, `[**]`) feed the shared
// settings; `[*.py]` feeds the Python (Ruff) overrides. Within those, later
// sections win, as in EditorConfig itself. Everything else is reported as
// ignored.
import { INDENT_WIDTH, LINE_WIDTH, REASONS, createCollector, toInt } from "./collect.js";

const ALL_FILES = new Set(["*", "**"]);
const PYTHON_FILES = new Set(["*.py", "**.py", "**/*.py"]);

const EOL = { lf: "lf", crlf: "crlf", cr: "cr" };
const QUOTES = { single: "single", double: "double", auto: "preserve" };

// Valid EditorConfig properties that don't map to a formatter option here.
const UNSUPPORTED = new Set([
  "charset",
  "trim_trailing_whitespace",
  "insert_final_newline",
  "tab_width",
  "spelling_language",
]);

/**
 * Parses EditorConfig's INI dialect.
 * @returns {Array<{ section: string|null, props: Array<[string, string]> }>}
 *   `section` is null for the preamble before the first [section].
 */
export function parseEditorConfig(text) {
  const sections = [{ section: null, props: [] }];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) continue;
    const header = line.match(/^\[(.*)\]$/);
    if (header) {
      sections.push({ section: header[1].trim(), props: [] });
      continue;
    }
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim().toLowerCase();
    // Inline comments are not part of the spec but common in the wild.
    const value = line
      .slice(eq + 1)
      .replace(/\s[#;].*$/, "")
      .trim()
      .toLowerCase();
    sections.at(-1).props.push([key, value]);
  }
  return sections.filter((s) => s.section !== null || s.props.length);
}

export function mapEditorConfig(text) {
  const c = createCollector();
  const shared = {};
  const python = {};
  let found = false;
  for (const { section, props } of parseEditorConfig(text)) {
    if (section === null) {
      for (const [key] of props) {
        if (key !== "root") c.ignore(key, "only allowed inside a section");
      }
      continue;
    }
    const target = ALL_FILES.has(section)
      ? shared
      : PYTHON_FILES.has(section)
        ? python
        : null;
    if (!target) {
      if (props.length) c.ignore(`[${section}]`, "only [*] and [*.py] are applied");
      continue;
    }
    found = true;
    for (const [key, value] of props) target[key] = value;
  }
  if (!found) {
    c.ignore("[*]", "no [*] section found");
    return c.result();
  }
  mapSection(shared, c, "", { indent: "indent", lineWidth: "lineWidth", quotes: "quotes" });
  mapSection(python, c, "[*.py] ", {
    indent: "pythonIndent",
    lineWidth: "pythonLineWidth",
    quotes: "pythonQuotes",
  });
  return c.result();
}

function mapSection(props, c, prefix, keys) {
  const opt = (k) => `${prefix}${k}`;
  for (const [key, value] of Object.entries(props)) {
    if (key === "indent_style" || key === "indent_size") continue;
    if (key === "max_line_length") {
      const n = toInt(value, ...LINE_WIDTH);
      if (n === null)
        c.ignore(opt(key), value === "off" ? "\"off\" is not supported" : REASONS.invalid(value));
      else c.apply(opt(key), value, keys.lineWidth, n);
    } else if (key === "end_of_line" && !prefix) {
      if (EOL[value]) c.apply(key, value, "endOfLine", EOL[value]);
      else c.ignore(key, REASONS.invalid(value));
    } else if (key === "quote_type") {
      if (QUOTES[value]) c.apply(opt(key), value, keys.quotes, QUOTES[value]);
      else c.ignore(opt(key), REASONS.invalid(value));
    } else if (UNSUPPORTED.has(key) || key === "end_of_line") {
      c.ignore(opt(key), REASONS.unsupported);
    } else {
      c.ignore(opt(key), REASONS.unknown);
    }
  }
  mapIndent(props, c, opt, keys.indent);
}

// indent_style = tab wins; indent_size = tab also means tabs. Spaces need
// a numeric indent_size to be meaningful.
function mapIndent(props, c, opt, setting) {
  const style = props.indent_style;
  const size = props.indent_size;
  const hasStyle = style !== undefined;
  const hasSize = size !== undefined;
  if (hasStyle && style !== "tab" && style !== "space") {
    c.ignore(opt("indent_style"), REASONS.invalid(style));
  }
  const width = hasSize && size !== "tab" ? toInt(size, ...INDENT_WIDTH) : null;
  if (hasSize && size !== "tab" && width === null) {
    c.ignore(opt("indent_size"), REASONS.invalid(size));
  }
  if (style === "tab" || (size === "tab" && style !== "space")) {
    const option = style === "tab" ? "indent_style" : "indent_size";
    c.apply(opt(option), "tab", setting, "tab");
    if (style === "tab" && width !== null) c.ignore(opt("indent_size"), "not used with tabs");
  } else if (width !== null) {
    c.apply(opt("indent_size"), size, setting, width);
  } else if (style === "space") {
    c.ignore(opt("indent_style"), "needs a numeric indent_size");
  }
}
