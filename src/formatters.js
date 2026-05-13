export class FormatError extends Error {
  constructor(message, { line = null, column = null, hint = null } = {}) {
    super(message);
    this.name = "FormatError";
    this.line = line;
    this.column = column;
    this.hint = hint;
  }
}

const DEFAULTS = { indent: 2, lineWidth: 80, quotes: "double" };

export async function formatCode(lang, src, opts = {}) {
  if (!src.trim()) return "";
  const o = { ...DEFAULTS, ...opts };
  switch (lang) {
    case "json":
      return formatJson(src, o);
    case "yaml":
      return formatWithPrettier(src, "yaml", o);
    case "markdown":
      return formatWithPrettier(src, "markdown", o);
    case "css":
      return formatWithPrettier(src, "css", o);
    case "html":
      return formatWithPrettier(src, "html", o);
    case "javascript":
      return formatWithPrettier(src, "babel", o);
    case "typescript":
      return formatWithPrettier(src, "typescript", o);
    case "jsx":
      return formatWithPrettier(src, "babel", o);
    case "tsx":
      return formatWithPrettier(src, "typescript", o);
    case "vue":
      return formatWithPrettier(src, "vue", o);
    case "shell":
      return formatShell(src, o);
    case "dockerfile":
      return formatDockerfile(src, o);
    case "python":
      return formatPython(src, o);
    case "dotenv":
      return formatDotenv(src, o);
    case "sql":
      return formatSql(src, o);
    default:
      return src;
  }
}

async function formatJson(src, opts) {
  const indent =
    opts.indent === "tab" ? "\t" : Math.max(1, Number(opts.indent) || 2);
  try {
    let parsed = JSON.parse(src);
    if (opts.jsonPath && opts.jsonPath.trim()) {
      const { JSONPath } = await import("jsonpath-plus");
      try {
        const result = JSONPath({ path: opts.jsonPath.trim(), json: parsed });
        parsed = result;
      } catch (qe) {
        throw new FormatError(`Invalid JSONPath: ${qe.message || qe}`, {
          hint: "Examples: $.foo, $..name, $.items[*].id",
        });
      }
    }
    return JSON.stringify(parsed, null, indent) + "\n";
  } catch (e) {
    if (e instanceof FormatError) throw e;
    const m = /position\s+(\d+)/i.exec(e.message || "");
    if (m) {
      const pos = Number(m[1]);
      const line = (src.slice(0, pos).match(/\n/g) || []).length + 1;
      const lastNl = src.lastIndexOf("\n", pos - 1);
      const column = pos - (lastNl + 1) + 1;
      throw new FormatError(e.message, {
        line,
        column,
        hint: "Check for trailing commas, single quotes, or missing brackets",
      });
    }
    throw new FormatError(e.message || "Invalid JSON");
  }
}

let _sqlFormatter = null;
async function getSqlFormatter() {
  if (_sqlFormatter) return _sqlFormatter;
  const mod = await import("sql-formatter");
  _sqlFormatter = mod;
  return mod;
}

async function formatSql(src, opts) {
  const { format } = await getSqlFormatter();
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

function formatDotenv(src) {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let prevBlank = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (!trimmed) {
      // collapse runs of blank lines to one, never emit leading blanks
      if (out.length > 0 && !prevBlank) out.push("");
      prevBlank = true;
      continue;
    }

    if (trimmed.startsWith("#")) {
      out.push(trimmed);
      prevBlank = false;
      continue;
    }

    const m = trimmed.match(
      /^(export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/
    );
    if (!m) {
      // Unknown line — keep as-is (rtrim only) so we don't destroy user content
      throw new FormatError(
        `Line ${i + 1} is not a KEY=value assignment`,
        { line: i + 1, hint: "dotenv lines must look like KEY=value or # comment" }
      );
    }

    const exportPrefix = m[1] ? "export " : "";
    const key = m[2];
    let value = m[3];

    // Strip a trailing inline comment that is OUTSIDE any quotes.
    value = stripInlineComment(value);

    // Trim surrounding whitespace from unquoted values; keep quoted values intact.
    if (!isQuoted(value)) value = value.trim();

    out.push(`${exportPrefix}${key}=${value}`);
    prevBlank = false;
  }

  // strip trailing blank line if any
  while (out.length && out[out.length - 1] === "") out.pop();

  return out.join("\n") + "\n";
}

function isQuoted(v) {
  return (
    (v.startsWith('"') && v.endsWith('"') && v.length >= 2) ||
    (v.startsWith("'") && v.endsWith("'") && v.length >= 2)
  );
}

function stripInlineComment(value) {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === "#" && !inSingle && !inDouble) {
      // require whitespace before # to avoid eating values like https://x#frag
      if (i === 0 || /\s/.test(value[i - 1])) {
        return value.slice(0, i).replace(/\s+$/, "");
      }
    }
  }
  return value;
}

let _prettierCore = null;
async function getPrettierCore() {
  if (_prettierCore) return _prettierCore;
  const mod = await import("prettier/standalone");
  _prettierCore = mod;
  return mod;
}

const _prettierPluginCache = new Map();
async function loadPlugin(name, importer) {
  if (_prettierPluginCache.has(name)) return _prettierPluginCache.get(name);
  const mod = await importer();
  const plugin = mod.default || mod;
  _prettierPluginCache.set(name, plugin);
  return plugin;
}

async function pluginsFor(parser) {
  switch (parser) {
    case "json":
      return Promise.all([
        loadPlugin("babel", () => import("prettier/plugins/babel")),
        loadPlugin("estree", () => import("prettier/plugins/estree")),
      ]);
    case "yaml":
      return Promise.all([
        loadPlugin("yaml", () => import("prettier/plugins/yaml")),
      ]);
    case "markdown":
      return Promise.all([
        loadPlugin("markdown", () => import("prettier/plugins/markdown")),
      ]);
    case "css":
      return Promise.all([
        loadPlugin("postcss", () => import("prettier/plugins/postcss")),
      ]);
    case "html":
      return Promise.all([
        loadPlugin("html", () => import("prettier/plugins/html")),
      ]);
    case "babel":
      return Promise.all([
        loadPlugin("babel", () => import("prettier/plugins/babel")),
        loadPlugin("estree", () => import("prettier/plugins/estree")),
      ]);
    case "typescript":
      return Promise.all([
        loadPlugin("typescript", () => import("prettier/plugins/typescript")),
        loadPlugin("estree", () => import("prettier/plugins/estree")),
      ]);
    // Vue SFC: html plugin handles <template>, babel/ts for <script>, postcss for <style>.
    case "vue":
      return Promise.all([
        loadPlugin("html", () => import("prettier/plugins/html")),
        loadPlugin("babel", () => import("prettier/plugins/babel")),
        loadPlugin("typescript", () => import("prettier/plugins/typescript")),
        loadPlugin("postcss", () => import("prettier/plugins/postcss")),
        loadPlugin("estree", () => import("prettier/plugins/estree")),
      ]);
    default:
      return [];
  }
}

async function formatWithPrettier(src, parser, opts = DEFAULTS) {
  const [core, plugins] = await Promise.all([
    getPrettierCore(),
    pluginsFor(parser),
  ]);
  const useTabs = opts.indent === "tab";
  try {
    return await core.format(src, {
      parser,
      plugins,
      tabWidth: useTabs ? 4 : Number(opts.indent) || 2,
      useTabs,
      printWidth: Number(opts.lineWidth) || 80,
      singleQuote: opts.quotes === "single",
    });
  } catch (e) {
    throw mapPrettierError(e);
  }
}

let _ruffWs = null;
let _ruffMod = null;
let _ruffInitPromise = null;

async function initRuff() {
  if (_ruffMod) return _ruffMod;
  if (!_ruffInitPromise) {
    _ruffInitPromise = (async () => {
      const mod = await import("@astral-sh/ruff-wasm-web");
      const wasmUrl = (
        await import("@astral-sh/ruff-wasm-web/ruff_wasm_bg.wasm?url")
      ).default;
      await mod.default(wasmUrl);
      _ruffMod = mod;
      return mod;
    })();
  }
  return _ruffInitPromise;
}

function mapRuffError(e) {
  const raw = e?.message || String(e);
  // ruff error often: "Failed to format: <msg> at <line>:<col>"
  const locMatch = raw.match(/(\d+):(\d+)/);
  const msg = raw
    .replace(/^Failed to format:\s*/i, "")
    .replace(/\s*at\s*\d+:\d+\s*$/i, "")
    .trim();
  return new FormatError(msg || "Could not parse Python source", {
    line: locMatch ? parseInt(locMatch[1], 10) : null,
    column: locMatch ? parseInt(locMatch[2], 10) : null,
  });
}

function mapPrettierError(e) {
  const loc = e?.loc?.start;
  const msg = (e?.message || String(e))
    .replace(/^\s*>?\s*\d+\s*\|.*$/gm, "")
    .replace(/^\s*\|\s*\^+\s*$/gm, "")
    .replace(/\n{2,}/g, "\n")
    .replace(/\s*\(\d+:\d+\)\s*$/m, "")
    .trim();
  return new FormatError(msg, {
    line: loc?.line ?? null,
    column: loc?.column ?? null,
  });
}

const MAX_LINE = 80;

function posToLineCol(src, pos) {
  let line = 1,
    col = 1;
  for (let i = 0; i < pos && i < src.length; i++) {
    if (src[i] === "\n") {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, col };
}

// Verify balanced brackets, ignoring contents inside strings and comments.
function checkBrackets(src, { lineComment = "#" } = {}) {
  const pairs = { "(": ")", "[": "]", "{": "}" };
  const opens = new Set("([{");
  const closes = new Set(")]}");
  const stack = [];
  let inStr = null;
  let inComment = false;
  let line = 1,
    col = 1;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "\n") {
      line++;
      col = 1;
      inComment = false;
      continue;
    }
    if (inComment) {
      col++;
      continue;
    }
    if (inStr) {
      if (c === "\\") {
        i++;
        col += 2;
        continue;
      }
      if (c === inStr) inStr = null;
      col++;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = c;
    } else if (lineComment && c === lineComment) {
      inComment = true;
    } else if (opens.has(c)) {
      stack.push({ char: c, line, col });
    } else if (closes.has(c)) {
      const top = stack.pop();
      if (!top || pairs[top.char] !== c) {
        throw new FormatError(`Unexpected ‘${c}’`, {
          line,
          column: col,
          hint: top
            ? `expected ‘${pairs[top.char]}’ to close ‘${top.char}’ from line ${top.line}`
            : "no opening bracket to match",
        });
      }
    }
    col++;
  }
  if (stack.length > 0) {
    const top = stack[stack.length - 1];
    throw new FormatError(`Unclosed ‘${top.char}’`, {
      line: top.line,
      column: top.col,
      hint: `expected a matching ‘${pairs[top.char]}’`,
    });
  }
}

/* ── helpers ─────────────────────────────────────────── */

function splitTopLevelCommas(s) {
  const out = [];
  let depth = 0;
  let inStr = null;
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      cur += c;
      if (c === inStr && s[i - 1] !== "\\") inStr = null;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = c;
      cur += c;
      continue;
    }
    if ("[({".includes(c)) depth++;
    if ("])}".includes(c)) depth--;
    if (c === "," && depth === 0) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  if (cur.trim() !== "" || out.length > 0) out.push(cur);
  return out;
}

function findMatchingClose(s, openIdx) {
  const openChar = s[openIdx];
  const closeChar = { "[": "]", "(": ")", "{": "}" }[openChar];
  let depth = 0;
  let inStr = null;
  for (let i = openIdx; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === inStr && s[i - 1] !== "\\") inStr = null;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = c;
      continue;
    }
    if (c === openChar) depth++;
    else if (c === closeChar) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// Break a line at the first bracket group, recursing into items that are still long.
function breakLongLine(line, maxLen = MAX_LINE, extraIndent = "    ") {
  if (line.length <= maxLen) return [line];
  const indent = (line.match(/^(\s*)/) || ["", ""])[1];
  const openMatch = line.slice(indent.length).match(/[\[(\{]/);
  if (!openMatch) return [line];
  const openIdx = indent.length + openMatch.index;
  const closeIdx = findMatchingClose(line, openIdx);
  if (closeIdx === -1) return [line];

  const prefix = line.slice(0, openIdx + 1);
  const inner = line.slice(openIdx + 1, closeIdx);
  const suffix = line.slice(closeIdx);

  const parts = splitTopLevelCommas(inner).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return [line];

  const itemIndent = indent + extraIndent;
  const out = [prefix];
  parts.forEach((p) => {
    const item = itemIndent + p + ",";
    if (item.length > maxLen) {
      out.push(...breakLongLine(item, maxLen, extraIndent));
    } else {
      out.push(item);
    }
  });
  out.push(indent + suffix);
  return out;
}


// kept for reference / fallback
// eslint-disable-next-line no-unused-vars
function _formatYamlHeuristic(src) {
  const lines = src.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const indent = lines[i].match(/^([ \t]*)/)[1];
    if (indent.includes("\t")) {
      throw new FormatError("Tabs are not allowed in YAML indentation", {
        line: i + 1,
        column: indent.indexOf("\t") + 1,
        hint: "use spaces instead",
      });
    }
  }

  const out = [];

  for (let raw of lines) {
    let line = raw.replace(/\s+$/g, "").replace(/\t/g, "  ");
    const m = line.match(/^(\s*)(.*)$/);
    const indent = m[1];
    let body = m[2];
    if (!body) {
      out.push("");
      continue;
    }
    body = body.replace(/^-\s*/, "- ");
    body = body.replace(/^([\w.\-]+)\s*:\s*/, "$1: ");

    // Expand flow sequence `key: [a, b, c]` → block
    const flow = body.match(/^([^:]+):\s*\[(.*)\]\s*$/);
    if (flow) {
      const key = flow[1];
      const items = splitTopLevelCommas(flow[2])
        .map((p) => p.trim())
        .filter(Boolean);
      if (items.length > 0) {
        out.push(indent + key + ":");
        const childIndent = indent + "  ";
        items.forEach((it) => out.push(childIndent + "- " + it));
        continue;
      }
    }

    // Expand flow mapping `key: {a: 1, b: 2}` → block
    const flowMap = body.match(/^([^:]+):\s*\{(.*)\}\s*$/);
    if (flowMap) {
      const key = flowMap[1];
      const items = splitTopLevelCommas(flowMap[2])
        .map((p) => p.trim())
        .filter(Boolean);
      if (items.length > 0) {
        out.push(indent + key + ":");
        const childIndent = indent + "  ";
        items.forEach((it) => out.push(childIndent + it));
        continue;
      }
    }

    out.push(indent + body);
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").replace(/\n+$/, "") + "\n";
}

/* ── shell ───────────────────────────────────────────── */

let _shPrint = null;
let _shInitPromise = null;
async function loadShPrint() {
  if (_shPrint) return _shPrint;
  if (!_shInitPromise) {
    _shInitPromise = (async () => {
      const mod = await import("sh-syntax");
      const wasmUrl = (await import("sh-syntax/main.wasm?url")).default;
      const processor = mod.getProcessor(() => fetch(wasmUrl));
      _shPrint = (text, opts) =>
        processor(text, { ...opts, print: true });
      return _shPrint;
    })();
  }
  return _shInitPromise;
}

function mapShError(e) {
  const raw = e?.message || String(e);
  // sh-syntax errors often: "<file>:<line>:<col>: <msg>"
  const m = raw.match(/:(\d+):(\d+):\s*(.+)$/);
  if (m) {
    return new FormatError(m[3].trim(), {
      line: parseInt(m[1], 10),
      column: parseInt(m[2], 10),
    });
  }
  return new FormatError(raw.trim());
}

async function formatShell(src, opts = DEFAULTS) {
  const print = await loadShPrint();
  const useTabs = opts.indent === "tab";
  try {
    return await print(src, {
      tabWidth: useTabs ? 4 : Number(opts.indent) || 2,
      useTabs,
    });
  } catch (e) {
    throw mapShError(e);
  }
}

/* ── dockerfile ──────────────────────────────────────── */

const DOCKER_INSTRUCTIONS = new Set([
  "FROM",
  "RUN",
  "CMD",
  "LABEL",
  "MAINTAINER",
  "EXPOSE",
  "ENV",
  "ADD",
  "COPY",
  "ENTRYPOINT",
  "VOLUME",
  "USER",
  "WORKDIR",
  "ARG",
  "ONBUILD",
  "STOPSIGNAL",
  "HEALTHCHECK",
  "SHELL",
]);

function formatDockerfile(src) {
  // Validate instruction names; ignore comments and continuation lines.
  const rawLines = src.split("\n");
  let cont = false;
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trim = line.trim();
    if (cont) {
      cont = line.trimEnd().endsWith("\\");
      continue;
    }
    if (!trim || trim.startsWith("#")) continue;
    const m = trim.match(/^(\S+)/);
    if (m) {
      const inst = m[1].toUpperCase();
      if (!DOCKER_INSTRUCTIONS.has(inst)) {
        throw new FormatError(`Unknown instruction “${m[1]}”`, {
          line: i + 1,
          column: line.indexOf(m[1]) + 1,
          hint: "expected FROM, RUN, COPY, CMD, etc.",
        });
      }
    }
    cont = line.trimEnd().endsWith("\\");
  }

  const out = [];
  for (const raw of src.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) {
      out.push("");
      continue;
    }
    if (line.trim().startsWith("#")) {
      out.push(line.trim());
      continue;
    }
    const m = line.match(/^\s*(\S+)\s+(.*)$/);
    if (!m) {
      out.push(line.trim());
      continue;
    }
    const word = m[1].toUpperCase();
    const rest = m[2].replace(/\s+/g, " ").trim();

    if (DOCKER_INSTRUCTIONS.has(word)) {
      // JSON-form array (CMD, ENTRYPOINT): expand if long
      if (
        rest.startsWith("[") &&
        rest.endsWith("]") &&
        (`${word} ${rest}`.length > MAX_LINE)
      ) {
        const parts = splitTopLevelCommas(rest.slice(1, -1))
          .map((p) => p.trim())
          .filter(Boolean);
        out.push(`${word} [`);
        parts.forEach((p, i) =>
          out.push(`    ${p}${i < parts.length - 1 ? "," : ""}`)
        );
        out.push(`]`);
        continue;
      }

      // RUN ... && ... && ... : split chains if long
      if (word === "RUN" && rest.length > MAX_LINE && rest.includes("&&")) {
        const chunks = rest.split(/\s*&&\s*/).map((c) => c.trim()).filter(Boolean);
        out.push(`RUN ${chunks[0]} \\`);
        chunks.slice(1).forEach((c, i) => {
          const suffix = i === chunks.length - 2 ? "" : " \\";
          out.push(`    && ${c}${suffix}`);
        });
        continue;
      }

      out.push(`${word} ${rest}`);
    } else {
      out.push(line.trim());
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").replace(/\n+$/, "") + "\n";
}

/* ── python ──────────────────────────────────────────── */

function reindentPython(src) {
  const lines = src.split("\n");
  const out = [];
  let prevLevel = -1;
  let prevEndsColon = false;
  let bracketDepth = 0;
  let inTriple = null;

  function scan(line) {
    let i = 0;
    let inStr = null;
    while (i < line.length) {
      const c = line[i];
      if (inTriple) {
        if (line.startsWith(inTriple, i)) {
          inTriple = null;
          i += 3;
          continue;
        }
        i++;
        continue;
      }
      if (inStr) {
        if (c === "\\") {
          i += 2;
          continue;
        }
        if (c === inStr) inStr = null;
        i++;
        continue;
      }
      if (c === "#") break;
      if (line.startsWith('"""', i) || line.startsWith("'''", i)) {
        inTriple = line.substr(i, 3);
        i += 3;
        continue;
      }
      if (c === '"' || c === "'") {
        inStr = c;
        i++;
        continue;
      }
      if ("([{".includes(c)) bracketDepth++;
      if (")]}".includes(c))
        bracketDepth = Math.max(0, bracketDepth - 1);
      i++;
    }
  }

  for (const raw of lines) {
    const line = raw.replace(/\t/g, "    ");

    if (!line.trim()) {
      out.push("");
      continue;
    }

    if (inTriple || bracketDepth > 0) {
      out.push(line);
      scan(line);
      continue;
    }

    const origIndent = (line.match(/^(\s*)/) || ["", ""])[1].length;
    const snapped = Math.round(origIndent / 4);
    let level;
    if (prevLevel < 0) {
      level = snapped;
    } else {
      const maxLevel = prevLevel + (prevEndsColon ? 1 : 0);
      level = Math.min(Math.max(snapped, 0), maxLevel);
    }
    const body = line.replace(/^\s+/, "");
    out.push("    ".repeat(level) + body);
    prevLevel = level;
    prevEndsColon = /:\s*(#.*)?$/.test(body);
    scan(line);
  }

  return out.join("\n");
}

let _ruffOptsKey = "";
async function getRuffWorkspaceFor(opts) {
  const mod = await initRuff();
  const useTabs = opts.indent === "tab";
  const indentWidth = useTabs ? 4 : Number(opts.indent) || 4;
  const key = `${opts.lineWidth}:${indentWidth}:${useTabs}:${opts.quotes}`;
  if (_ruffWs && _ruffOptsKey === key) return _ruffWs;
  const settings = {
    "line-length": Number(opts.lineWidth) || 88,
    "indent-width": indentWidth,
    format: {
      "indent-style": useTabs ? "tab" : "space",
      "quote-style":
        opts.quotes === "single"
          ? "single"
          : opts.quotes === "double"
            ? "double"
            : "preserve",
    },
  };
  _ruffWs = new mod.Workspace(settings, mod.PositionEncoding.Utf16);
  _ruffOptsKey = key;
  return _ruffWs;
}

async function formatPython(src, opts = DEFAULTS) {
  const ws = await getRuffWorkspaceFor(opts);
  try {
    return ws.format(src);
  } catch (e) {
    throw mapRuffError(e);
  }
}
