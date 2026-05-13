import { FormatError } from "./errors.js";

let _mod = null;
async function getFormatter() {
  if (_mod) return _mod;
  _mod = await import("sql-formatter");
  return _mod;
}

export async function formatSql(src, opts) {
  const { format } = await getFormatter();
  try {
    return format(src, {
      language: "sql",
      tabWidth: opts.indent === "tab" ? 1 : Number(opts.indent) || 2,
      useTabs: opts.indent === "tab",
      keywordCase: "upper",
      linesBetweenQueries: 2,
    });
  } catch (e) {
    const m = /line (\d+)/i.exec(e.message || "");
    throw new FormatError(e.message || "SQL parse error", {
      line: m ? Number(m[1]) : null,
      hint: "Check for unmatched parens or stray punctuation",
    });
  }
}
