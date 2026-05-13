// Language detection heuristics. Two entry points:
//   - detectLangFromFilename(name)  — fast and authoritative (".tsx" → "tsx")
//   - detectLangFromContent(src)    — best-effort, used after a paste
//
// Detection is intentionally conservative — if nothing matches with reasonable
// confidence we return null and the UI keeps the user's current selection.
import { EXT_TO_LANG } from "./registry.js";

export function detectLangFromFilename(name) {
  if (!name) return null;
  const base = name.toLowerCase();
  if (base === "dockerfile" || base.endsWith(".dockerfile")) return "dockerfile";
  if (base === ".env" || base.startsWith(".env.")) return "dotenv";
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
  if (/^<\?xml|^<!doctype\s+html|^<html\b|^<!DOCTYPE/i.test(firstLine.trim()))
    return "html";

  // Vue SFC fingerprint: a top-level <template> or <script setup> block.
  if (/^<template(\s|>)/m.test(head) && /<\/template>/.test(head))
    return "vue";
  if (/^<script\s+setup\b/m.test(head) && /<\/script>/.test(head))
    return "vue";

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
