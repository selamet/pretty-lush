// Public surface for code formatting.
//
// The shape is a single async function `formatCode(lang, src, opts)` plus
// the `FormatError` class. Adding a new language is a three-step change:
//   1. write a new module under src/formatters/<lang>.js
//   2. add a case to the switch below
//   3. register the language in src/languages/registry.js and the
//      CodeMirror map in src/languages/codemirror.js
import { formatJson } from "./json.js";
import { formatSql } from "./sql.js";
import { formatPython } from "./python.js";
import { formatShell } from "./shell.js";
import { formatDotenv } from "./dotenv.js";
import { formatDockerfile } from "./dockerfile.js";
import { formatWithPrettier } from "./prettier.js";

export { FormatError } from "./errors.js";

const DEFAULTS = { indent: 2, lineWidth: 80, quotes: "double" };

export async function formatCode(lang, src, opts = {}) {
  if (!src.trim()) return "";
  const o = { ...DEFAULTS, ...opts };
  switch (lang) {
    case "json":       return formatJson(src, o);
    case "yaml":       return formatWithPrettier(src, "yaml", o);
    case "markdown":   return formatWithPrettier(src, "markdown", o);
    case "css":        return formatWithPrettier(src, "css", o);
    case "html":       return formatWithPrettier(src, "html", o);
    case "javascript": return formatWithPrettier(src, "babel", o);
    case "typescript": return formatWithPrettier(src, "typescript", o);
    case "jsx":        return formatWithPrettier(src, "babel", o);
    case "tsx":        return formatWithPrettier(src, "typescript", o);
    case "vue":        return formatWithPrettier(src, "vue", o);
    case "shell":      return formatShell(src, o);
    case "dockerfile": return formatDockerfile(src, o);
    case "python":     return formatPython(src, o);
    case "dotenv":     return formatDotenv(src, o);
    case "sql":        return formatSql(src, o);
    default:           return src;
  }
}
