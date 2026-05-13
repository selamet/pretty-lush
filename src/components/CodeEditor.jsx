import { useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView, Decoration, ViewPlugin, keymap } from "@codemirror/view";
import { RangeSetBuilder, EditorSelection, Prec } from "@codemirror/state";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { getSearchQuery } from "@codemirror/search";
import { tags as t } from "@lezer/highlight";
import { getThemeMeta } from "../editor-themes.js";
import { LANG_MAP } from "../languages/codemirror.js";

// Cmd/Ctrl+G — multi-cursor on every occurrence of:
//   1. the current selection (if any), or
//   2. the word at the caret (if collapsed)
function selectAllOccurrences(view) {
  const { state } = view;
  const sel = state.selection.main;

  let needle;
  if (sel.empty) {
    const word = state.wordAt(sel.head);
    if (!word) return false;
    needle = state.sliceDoc(word.from, word.to);
  } else {
    needle = state.sliceDoc(sel.from, sel.to);
  }
  if (!needle) return false;

  const doc = state.doc.toString();
  const ranges = [];
  let i = 0;
  while (true) {
    const idx = doc.indexOf(needle, i);
    if (idx === -1) break;
    ranges.push(EditorSelection.range(idx, idx + needle.length));
    i = idx + Math.max(1, needle.length);
  }
  if (ranges.length === 0) return false;

  view.dispatch({
    selection: EditorSelection.create(ranges, ranges.length - 1),
    scrollIntoView: true,
  });
  return true;
}

const multiCursorKeymap = Prec.highest(
  keymap.of([
    { key: "Mod-g", run: selectAllOccurrences, preventDefault: true },
  ])
);

// Floating "X of Y" badge that appears when a search query is active.
const matchCountPlugin = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.view = view;
      this.dom = document.createElement("div");
      this.dom.className = "cm-match-count";
      this.dom.style.display = "none";
      view.dom.appendChild(this.dom);
      this.compute();
    }

    update(update) {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.transactions.length > 0
      ) {
        this.compute();
      }
    }

    compute() {
      const state = this.view.state;
      let query;
      try {
        query = getSearchQuery(state);
      } catch {
        this.dom.style.display = "none";
        return;
      }

      if (!query || !query.search) {
        this.dom.style.display = "none";
        return;
      }

      let total = 0;
      let current = 0;
      const main = state.selection.main;

      try {
        const cursor = query.getCursor(state.doc);
        let item = cursor.next();
        while (!item.done) {
          total++;
          if (
            item.value.from === main.from &&
            item.value.to === main.to
          ) {
            current = total;
          }
          item = cursor.next();
          // safety stop for runaway regex
          if (total > 100000) break;
        }
      } catch {
        this.dom.style.display = "";
        this.dom.textContent = "invalid pattern";
        this.dom.dataset.state = "err";
        return;
      }

      if (total === 0) {
        this.dom.style.display = "";
        this.dom.textContent = "no matches";
        this.dom.dataset.state = "empty";
        return;
      }

      this.dom.style.display = "";
      this.dom.dataset.state = "ok";
      this.dom.textContent =
        current > 0
          ? `${current} of ${total}`
          : `${total} match${total === 1 ? "" : "es"}`;
    }

    destroy() {
      this.dom.remove();
    }
  }
);

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

  const extensions = [multiCursorKeymap, matchCountPlugin];
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
        searchKeymap: true,
        bracketMatching: true,
        closeBrackets: !readOnly,
        indentOnInput: !readOnly,
      }}
      style={{ height: "100%" }}
    />
  );
}
