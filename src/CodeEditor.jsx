import { useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView, Decoration, ViewPlugin } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { HighlightStyle, syntaxHighlighting, StreamLanguage } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { getThemeMeta } from "./themes.js";
import { python } from "@codemirror/lang-python";
import { json } from "@codemirror/lang-json";
import { yaml } from "@codemirror/lang-yaml";
import { markdown } from "@codemirror/lang-markdown";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { sql } from "@codemirror/lang-sql";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { dockerFile } from "@codemirror/legacy-modes/mode/dockerfile";
import { properties } from "@codemirror/legacy-modes/mode/properties";

const LANG_MAP = {
  python: python(),
  json: json(),
  yaml: yaml(),
  markdown: markdown(),
  css: css(),
  html: html(),
  javascript: javascript(),
  typescript: javascript({ typescript: true }),
  sql: sql(),
  shell: StreamLanguage.define(shell),
  dockerfile: StreamLanguage.define(dockerFile),
  dotenv: StreamLanguage.define(properties),
};

const lightHighlight = HighlightStyle.define([
  { tag: [t.keyword, t.modifier, t.controlKeyword], color: "#6b2f4a" },
  { tag: [t.string, t.special(t.string), t.regexp], color: "#166534" },
  { tag: [t.number, t.bool, t.null], color: "#b54708" },
  { tag: [t.comment, t.lineComment, t.blockComment], color: "#8a8d92", fontStyle: "italic" },
  { tag: [t.function(t.variableName), t.definition(t.function(t.variableName))], color: "#1f6f4a" },
  { tag: [t.definition(t.variableName), t.definition(t.propertyName)], color: "#16181a" },
  { tag: [t.propertyName, t.attributeName], color: "#1f3a5f" },
  { tag: [t.typeName, t.className], color: "#856230" },
  { tag: [t.operator, t.derefOperator, t.punctuation, t.bracket], color: "#6b7280" },
  { tag: [t.meta, t.processingInstruction], color: "#856230" },
  { tag: [t.tagName], color: "#6b2f4a", fontWeight: "500" },
  { tag: [t.variableName], color: "#16181a" },
]);

const darkHighlight = HighlightStyle.define([
  { tag: [t.keyword, t.modifier, t.controlKeyword], color: "#e08aa8" },
  { tag: [t.string, t.special(t.string), t.regexp], color: "#7dd6a2" },
  { tag: [t.number, t.bool, t.null], color: "#f0a868" },
  { tag: [t.comment, t.lineComment, t.blockComment], color: "#6f756e", fontStyle: "italic" },
  { tag: [t.function(t.variableName), t.definition(t.function(t.variableName))], color: "#4cc187" },
  { tag: [t.definition(t.variableName), t.definition(t.propertyName)], color: "#e8e6df" },
  { tag: [t.propertyName, t.attributeName], color: "#a8c5e8" },
  { tag: [t.typeName, t.className], color: "#e0b876" },
  { tag: [t.operator, t.derefOperator, t.punctuation, t.bracket], color: "#9ba2a5" },
  { tag: [t.meta, t.processingInstruction], color: "#e0b876" },
  { tag: [t.tagName], color: "#e08aa8", fontWeight: "500" },
  { tag: [t.variableName], color: "#e8e6df" },
]);

const lightTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "transparent",
      color: "#16181a",
      height: "100%",
      fontSize: "13px",
    },
    ".cm-scroller": {
      fontFamily:
        '"Geist Mono", ui-monospace, "SF Mono", Menlo, monospace',
      lineHeight: "1.6",
    },
    ".cm-content": { padding: "14px 0", caretColor: "#1f6f4a" },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: "#bfc2c6",
      border: "none",
      paddingRight: "8px",
    },
    ".cm-lineNumbers .cm-gutterElement": { padding: "0 4px 0 12px", fontSize: "11px" },
    ".cm-activeLine": { backgroundColor: "rgba(31, 111, 74, 0.04)" },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "#16181a" },
    ".cm-cursor": { borderLeftColor: "#1f6f4a" },
    "&.cm-focused": { outline: "none" },
    ".cm-selectionBackground, ::selection": {
      backgroundColor: "rgba(31, 111, 74, 0.14) !important",
    },
    ".cm-line": { padding: "0 16px" },
  },
  { dark: false }
);

// Applied AFTER any external theme to keep font, padding and line metrics consistent.
const baseLayout = EditorView.theme({
  "&": { height: "100%", fontSize: "13px" },
  ".cm-scroller": {
    fontFamily:
      '"Geist Mono", ui-monospace, "SF Mono", Menlo, monospace',
    lineHeight: "1.6",
  },
  ".cm-content": { padding: "14px 0" },
  ".cm-line": { padding: "0 16px" },
  ".cm-gutters": { paddingRight: "8px" },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 4px 0 12px",
    fontSize: "11px",
  },
  "&.cm-focused": { outline: "none" },
});

const darkTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "transparent",
      color: "#e8e6df",
      height: "100%",
      fontSize: "13px",
    },
    ".cm-scroller": {
      fontFamily:
        '"Geist Mono", ui-monospace, "SF Mono", Menlo, monospace',
      lineHeight: "1.6",
    },
    ".cm-content": { padding: "14px 0", caretColor: "#4cc187" },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: "#4d534c",
      border: "none",
      paddingRight: "8px",
    },
    ".cm-lineNumbers .cm-gutterElement": { padding: "0 4px 0 12px", fontSize: "11px" },
    ".cm-activeLine": { backgroundColor: "rgba(76, 193, 135, 0.06)" },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "#e8e6df" },
    ".cm-cursor": { borderLeftColor: "#4cc187" },
    "&.cm-focused": { outline: "none" },
    ".cm-selectionBackground, ::selection": {
      backgroundColor: "rgba(76, 193, 135, 0.22) !important",
    },
    ".cm-line": { padding: "0 16px" },
  },
  { dark: true }
);

function errorLineExtension(line) {
  return ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = this.build(view);
      }
      update(update) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.build(update.view);
        }
      }
      build(view) {
        const builder = new RangeSetBuilder();
        if (line && line > 0 && line <= view.state.doc.lines) {
          const ln = view.state.doc.line(line);
          builder.add(
            ln.from,
            ln.from,
            Decoration.line({ class: "cm-error-line" })
          );
        }
        return builder.finish();
      }
    },
    { decorations: (v) => v.decorations }
  );
}

const _externalThemeCache = new Map();

function useExternalTheme(themeId) {
  const meta = getThemeMeta(themeId);
  const [loaded, setLoaded] = useState(() =>
    meta?.builtin ? null : _externalThemeCache.get(themeId) || null
  );

  useEffect(() => {
    if (!meta || meta.builtin) {
      setLoaded(null);
      return;
    }
    if (_externalThemeCache.has(themeId)) {
      setLoaded(_externalThemeCache.get(themeId));
      return;
    }
    let cancelled = false;
    meta
      .load()
      .then((ext) => {
        _externalThemeCache.set(themeId, ext);
        if (!cancelled) setLoaded(ext);
      })
      .catch(() => {
        if (!cancelled) setLoaded(null);
      });
    return () => {
      cancelled = true;
    };
  }, [themeId, meta]);

  return { meta, ext: loaded };
}

export default function CodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  placeholder,
  theme = "pretty-lush-light",
  errorLine = null,
}) {
  const { meta, ext: externalExt } = useExternalTheme(theme);
  const isDark = meta?.mode === "dark";

  const langExt = LANG_MAP[language];

  const extensions = [];
  if (externalExt) {
    extensions.push(externalExt);
    extensions.push(baseLayout);
  } else {
    // built-in pretty-lush
    extensions.push(isDark ? darkTheme : lightTheme);
    extensions.push(
      isDark ? syntaxHighlighting(darkHighlight) : syntaxHighlighting(lightHighlight)
    );
  }
  if (langExt) extensions.push(langExt);
  if (errorLine) extensions.push(errorLineExtension(errorLine));

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      readOnly={readOnly}
      placeholder={placeholder}
      theme="none"
      height="100%"
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: !readOnly,
        highlightActiveLineGutter: !readOnly,
        autocompletion: false,
        searchKeymap: false,
        bracketMatching: true,
        closeBrackets: !readOnly,
        indentOnInput: !readOnly,
      }}
      style={{ height: "100%" }}
    />
  );
}
