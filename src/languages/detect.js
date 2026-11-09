// Language detection heuristics. Two entry points:
//   - detectLangFromFilename(name)  — fast and authoritative (".tsx" → "tsx")
//   - detectLangFromContent(src)    — best-effort, used after a paste
//
// Detection is intentionally conservative — if nothing matches with reasonable
// confidence we return null and the UI keeps the user's current selection.
import { EXT_TO_LANG } from "./registry.js";

// Well-known extensionless INI-style dotfiles.
const INI_FILENAMES = new Set([".editorconfig", ".gitconfig", ".npmrc", ".pylintrc"]);

// --- INI / TOML -----------------------------------------------------------
// Both use `[section]` headers and `key = value` lines. TOML values are typed
// (quoted strings, numbers, booleans, dates, arrays, inline tables) while INI
// values are bare text, which is what tells them apart.
const SECTION_LINE = /^\[\[?\s*[\w"'.\- ]+?\s*\]\]?\s*([#;].*)?$/;
const KEY = String.raw`(?:[\w-]+|"[^"]*"|'[^']*')`;
const ASSIGN_LINE = new RegExp(`^(${KEY}(?:\\s*\\.\\s*${KEY})*)\\s*([=:])\\s*(.*)$`);
const TOML_VALUE =
  /^("|'|\[|\{|true\b|false\b|[+-]?(inf|nan)\b|[+-]?\d[\d_]*(\.\d+)?([eE][+-]?\d+)?\s*(#.*)?$|0[xob][\da-fA-F_]+\s*(#.*)?$|\d{4}-\d{2}-\d{2})/;
// Lines inside a multi-line TOML array (`"a",`, `1,`, `]`).
const ARRAY_ITEM_LINE = /^([\]}]|["'\d{[+-]|.*,\s*(#.*)?$)/;

function detectIniOrToml(head) {
  const lines = head
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  let sections = 0;
  let arrayTables = 0;
  let semicolonComments = 0;
  const assigns = [];
  let other = 0;
  for (const line of lines) {
    if (line.startsWith("#")) continue;
    if (line.startsWith(";")) {
      semicolonComments++;
      continue;
    }
    if (SECTION_LINE.test(line)) {
      sections++;
      if (line.startsWith("[[")) arrayTables++;
      continue;
    }
    const m = line.match(ASSIGN_LINE);
    if (m) assigns.push({ key: m[1], sep: m[2], value: m[3] });
    else if (!ARRAY_ITEM_LINE.test(line)) other++;
  }
  if (other > 0 || assigns.length === 0 || sections + assigns.length < 2) return null;

  const typed = assigns.every(
    (a) => a.sep === "=" && TOML_VALUE.test(a.value) && !/;\s*$/.test(a.value)
  );
  if (typed && semicolonComments === 0) {
    // Without headers, `KEY="x"` lines are far more likely dotenv; require a
    // lowercase key (TOML convention) or a table header.
    if (arrayTables > 0 || sections > 0 || assigns.some((a) => /[a-z]/.test(a.key)))
      return "toml";
  }
  if (sections > 0 || semicolonComments > 0) return "ini";
  return null;
}

// --- GraphQL --------------------------------------------------------------
function looksLikeGraphql(head) {
  // Executable documents: `query Name($id: ID!) {`, `fragment X on Y {`, …
  if (/^(query|mutation|subscription)\b[^=;]*\{/m.test(head)) return true;
  if (/^fragment\s+\w+\s+on\s+\w+/m.test(head)) return true;
  // SDL. `type` / `interface` / `enum` also exist in TypeScript, so require a
  // GraphQL-only signal: non-null `!` markers, `implements` without `{`
  // generics, or SDL-only keywords — and no TypeScript `;` / `=` bodies.
  if (!/^(type|input|enum|interface|union|scalar|schema|extend|directive)\b/m.test(head))
    return false;
  if (/;\s*$/m.test(head) || /^(type|interface)\s+\w+\s*(<[^>]*>)?\s*=/m.test(head))
    return false;
  return (
    /\w!|\]!/.test(head) ||
    /^(input|scalar|schema|directive\s+@|extend\s+(type|schema|input|interface|enum|union))\b/m.test(head) ||
    /^union\s+\w+\s*=\s*\w+\s*\|/m.test(head) ||
    /^type\s+\w+\s+implements\s+\w+/m.test(head)
  );
}

export function detectLangFromFilename(name) {
  if (!name) return null;
  const base = name.toLowerCase();
  if (base === "dockerfile" || base.endsWith(".dockerfile")) return "dockerfile";
  if (base === ".env" || base.startsWith(".env.")) return "dotenv";
  if (INI_FILENAMES.has(base)) return "ini";
  const dot = base.lastIndexOf(".");
  if (dot < 0) return null;
  return EXT_TO_LANG[base.slice(dot + 1)] || null;
}

export function detectLangFromContent(src) {
  const text = src.trim();
  if (!text || text.length < 20) return null;
  const head = text.slice(0, 4000);
  const firstLine = head.split("\n", 1)[0];

  if (/^#!\s*\/.*\b(bash|sh|zsh)\b/m.test(head)) return "shell";
  if (/^FROM\s+\S+/m.test(head) && /^(RUN|CMD|COPY|EXPOSE|ENV|WORKDIR)\b/m.test(head))
    return "dockerfile";
  {
    const first = firstLine.trim();
    if (/^<!doctype\s+html|^<html\b/i.test(first)) return "html";
    // XML prolog, SVG root, a non-HTML DOCTYPE or a namespaced root element.
    if (/^<\?xml\b|^<svg\b|^<!DOCTYPE\s+(?!html)\w/i.test(first)) return "xml";
    if (/^<[\w:-]+[^>]*\sxmlns(:[\w-]+)?=/.test(head)) return "xml";
  }

  // Vue SFC fingerprint: a top-level <template> or <script setup> block.
  if (/^<template(\s|>)/m.test(head) && /<\/template>/.test(head))
    return "vue";
  if (/^<script\s+setup\b/m.test(head) && /<\/script>/.test(head))
    return "vue";

  if (looksLikeGraphql(head)) return "graphql";
  {
    const iniOrToml = detectIniOrToml(head);
    if (iniOrToml) return iniOrToml;
  }

  if (/^---\s*$/m.test(head) || /^[a-z_][\w-]*:\s/m.test(head)) {
    if (!/^\s*[\{\[]/.test(text) && !/[\{\}]/.test(firstLine)) return "yaml";
  }
  if (/^\s*[\{\[]/.test(text)) {
    try {
      JSON.parse(text);
      return "json";
    } catch {}
  }
  if (
    /^\s*(select|insert\s+into|update|delete\s+from|create\s+(table|view|index|database|schema)|with\s+\w+\s+as|alter\s+table|drop\s+table|truncate\s+table)\b/i.test(
      head
    )
  )
    return "sql";
  if (/^(def|class|import|from)\s+\w/m.test(head) || /^\s+\w.*:\s*$/m.test(head))
    return "python";

  // Dotenv: at least two meaningful non-comment lines, all KEY=value.
  {
    const lines = head.split("\n").map((l) => l.trim()).filter(Boolean);
    const meaningful = lines.filter((l) => !l.startsWith("#"));
    if (meaningful.length >= 2) {
      const envLike = meaningful.filter((l) =>
        /^(export\s+)?[A-Z_][A-Z0-9_]*\s*=/i.test(l)
      );
      if (envLike.length === meaningful.length) return "dotenv";
    }
  }

  // JSX/TSX heuristic: a JSX-looking element near a JS-ish keyword.
  const hasJsx =
    /<([A-Z][A-Za-z0-9]*|>)/.test(head) ||
    /\breturn\s*\(\s*</.test(head) ||
    /<\w+[^>]*\s+[A-Za-z]+=\{/.test(head);
  if (
    /^(interface|type)\s+\w/m.test(head) ||
    /:\s*(string|number|boolean|any)\b/.test(head)
  )
    return hasJsx ? "tsx" : "typescript";
  if (
    /^(const|let|var|function|export|import)\b/m.test(head) ||
    /=>\s*[\{(]/m.test(head)
  )
    return hasJsx ? "jsx" : "javascript";

  if (/^#{1,6}\s+\S/m.test(head) || /\[[^\]]+\]\([^)]+\)/.test(head))
    return "markdown";
  if (/^[\w*.#:-]+\s*\{[^}]*[:;]/m.test(head)) return "css";

  return null;
}
