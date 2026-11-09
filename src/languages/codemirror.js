// Language id → lazy loader for its CodeMirror 6 language extension. Used
// only by components/CodeEditor.jsx.
//
// Every language pack is loaded with a dynamic import() so none of them land
// in the main entry chunk. The editor renders immediately as plain text and
// picks up highlighting once the pack resolves; resolved packs are cached so
// switching back to a language is synchronous.
//
// `javascript({ jsx: true })` covers JSX and TSX; CM6's core has no
// dedicated Vue grammar, so the HTML mode is used for Vue SFCs (the
// embedded <script> and <style> blocks lose their inner highlighting,
// but bracket matching and indentation still work).

// @codemirror/language is already part of the editor core, so StreamLanguage
// is imported statically; only the legacy mode definitions are deferred.
import { StreamLanguage } from "@codemirror/language";

const legacy = (load) => load().then((mode) => StreamLanguage.define(mode));

export const LANG_LOADERS = {
  python: () => import("@codemirror/lang-python").then((m) => m.python()),
  json: () => import("@codemirror/lang-json").then((m) => m.json()),
  yaml: () => import("@codemirror/lang-yaml").then((m) => m.yaml()),
  markdown: () => import("@codemirror/lang-markdown").then((m) => m.markdown()),
  css: () => import("@codemirror/lang-css").then((m) => m.css()),
  html: () => import("@codemirror/lang-html").then((m) => m.html()),
  javascript: () =>
    import("@codemirror/lang-javascript").then((m) => m.javascript()),
  typescript: () =>
    import("@codemirror/lang-javascript").then((m) =>
      m.javascript({ typescript: true })
    ),
  jsx: () =>
    import("@codemirror/lang-javascript").then((m) => m.javascript({ jsx: true })),
  tsx: () =>
    import("@codemirror/lang-javascript").then((m) =>
      m.javascript({ jsx: true, typescript: true })
    ),
  vue: () => import("@codemirror/lang-html").then((m) => m.html()),
  sql: () => import("@codemirror/lang-sql").then((m) => m.sql()),
  shell: () =>
    legacy(() =>
      import("@codemirror/legacy-modes/mode/shell").then((m) => m.shell)
    ),
  dockerfile: () =>
    legacy(() =>
      import("@codemirror/legacy-modes/mode/dockerfile").then((m) => m.dockerFile)
    ),
  xml: () => import("@codemirror/lang-xml").then((m) => m.xml()),
  graphql: () =>
    legacy(() => import("./graphql-mode.js").then((m) => m.graphql)),
  toml: () =>
    legacy(() =>
      import("@codemirror/legacy-modes/mode/toml").then((m) => m.toml)
    ),
  ini: () =>
    legacy(() =>
      import("@codemirror/legacy-modes/mode/properties").then((m) => m.properties)
    ),
  dotenv: () =>
    legacy(() =>
      import("@codemirror/legacy-modes/mode/properties").then((m) => m.properties)
    ),
};

const resolved = new Map();
const pending = new Map();

// Synchronous lookup of an already-loaded language extension (or null).
export function getLoadedLanguage(id) {
  return resolved.get(id) || null;
}

// Load (once) and cache the language extension for `id`. Resolves to null
// for unknown ids or when the pack fails to load (e.g. offline before it was
// ever cached) — the editor then simply stays in plain-text mode.
export function loadLanguage(id) {
  if (resolved.has(id)) return Promise.resolve(resolved.get(id));
  if (pending.has(id)) return pending.get(id);
  const loader = LANG_LOADERS[id];
  if (!loader) return Promise.resolve(null);
  const promise = loader()
    .then((ext) => {
      resolved.set(id, ext);
      return ext;
    })
    .catch(() => null)
    .finally(() => pending.delete(id));
  pending.set(id, promise);
  return promise;
}
