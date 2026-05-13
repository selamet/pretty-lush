// Language id → CodeMirror 6 language extension. Used only by
// components/CodeEditor.jsx.
//
// `javascript({ jsx: true })` covers JSX and TSX; CM6's core has no
// dedicated Vue grammar, so the HTML mode is used for Vue SFCs (the
// embedded <script> and <style> blocks lose their inner highlighting,
// but bracket matching and indentation still work).
import { python } from "@codemirror/lang-python";
import { json } from "@codemirror/lang-json";
import { yaml } from "@codemirror/lang-yaml";
import { markdown } from "@codemirror/lang-markdown";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { sql } from "@codemirror/lang-sql";
import { StreamLanguage } from "@codemirror/language";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { dockerFile } from "@codemirror/legacy-modes/mode/dockerfile";
import { properties } from "@codemirror/legacy-modes/mode/properties";

export const LANG_MAP = {
  python: python(),
  json: json(),
  yaml: yaml(),
  markdown: markdown(),
  css: css(),
  html: html(),
  javascript: javascript(),
  typescript: javascript({ typescript: true }),
  jsx: javascript({ jsx: true }),
  tsx: javascript({ jsx: true, typescript: true }),
  vue: html(),
  sql: sql(),
  shell: StreamLanguage.define(shell),
  dockerfile: StreamLanguage.define(dockerFile),
  dotenv: StreamLanguage.define(properties),
};
