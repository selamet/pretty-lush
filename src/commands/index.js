// ⌘K palette command list.
//
// `buildCommands` is pure: it takes the bits of app state that affect labels
// plus an `actions` object of callbacks, and returns the array consumed by
// components/CommandPalette.jsx. To add a command:
//   - an input → output text transform or a tool modal: add an entry to
//     TEXT_TOOLS in ./text-tools.js (no App changes needed);
//   - anything else: add an entry below and, if it needs new behaviour, a
//     callback to `actions` where App calls buildCommands.
// Languages and editor themes are generated from their registries.
import { LANGUAGES } from "../languages/registry.js";
import { THEMES, flipTheme } from "../editor-themes.js";
import { TEXT_TOOLS } from "./text-tools.js";
import { CONVERSIONS } from "../convert/index.js";
import { TYPEGEN_TARGETS } from "../codegen/index.js";
import { CURL_TARGETS } from "../curl/index.js";
import { ID_KINDS } from "../text-utils/ids.js";

/**
 * @param {object} ctx
 * @param {"split"|"diff"|"compare"|"regex"} ctx.viewMode
 * @param {boolean} ctx.outputFullscreen
 * @param {"light"|"dark"} ctx.themeMode
 * @param {object} ctx.settings
 * @param {object} ctx.actions  format, share, clearInput, setViewMode,
 *   toggleFullscreen, copyOutput, openSettings, updateSettings(fn),
 *   selectLang(id), runTextUtil(label, fn, { useSelection }) — with
 *   useSelection, a non-empty input selection is transformed in place,
 *   openToolModal(tool),
 *   convert({ from, to }) — data-format conversion of the current input,
 *   generateTypes(targetId) — show types generated from the JSON input,
 *   convertCurl(targetId) — show code converted from the cURL input,
 *   toggleSchema() — JSON Schema validation panel on / off,
 *   generateSchema() — replace the schema with one inferred from the input,
 *   searchTree() — focus the search box of the JSON tree view,
 *   insertText(text, label) — put generated text at the input cursor,
 *   openIdGenerator() — open the "Generate N IDs" modal
 * @param {boolean} [ctx.schemaOn]  schema validation currently shown
 */
export function buildCommands({
  viewMode,
  outputFullscreen,
  schemaOn = false,
  themeMode,
  settings,
  actions,
}) {
  return [
    {
      id: "format",
      label: "Format",
      shortcut: "⌘⏎",
      run: () => actions.format(),
    },
    {
      id: "share",
      label: "Share snippet…",
      keywords: "link copy encrypted password",
      run: () => actions.share(),
    },
    {
      id: "clear",
      label: "Clear input",
      run: () => actions.clearInput(),
    },
    {
      id: "diff",
      label: viewMode === "diff" ? "Switch to split view" : "Switch to diff view",
      run: () => actions.setViewMode(viewMode === "diff" ? "split" : "diff"),
    },
    {
      id: "compare",
      label: "Compare two snippets (A vs B)",
      keywords: "diff",
      run: () => actions.setViewMode("compare"),
    },
    {
      id: "regex",
      label: "Regex tester",
      keywords: "regular expression regexp pattern match test replace capture group",
      run: () => actions.setViewMode("regex"),
    },
    {
      id: "fullscreen",
      label: outputFullscreen ? "Exit fullscreen output" : "Fullscreen output",
      keywords: "zen focus expand",
      run: () => actions.toggleFullscreen(),
    },
    {
      id: "copy-output",
      label: "Copy output",
      keywords: "clipboard",
      run: () => actions.copyOutput(),
    },
    {
      id: "settings",
      label: "Open more options",
      run: () => actions.openSettings(),
    },
    {
      id: "theme-flip",
      label: themeMode === "dark" ? "Switch to light theme" : "Switch to dark theme",
      run: () =>
        actions.updateSettings((s) => ({
          ...s,
          editorTheme: flipTheme(s.editorTheme),
        })),
    },
    {
      id: "lint-toggle",
      label: settings?.lint ? "Turn off Python lint (Ruff)" : "Turn on Python lint (Ruff)",
      keywords: "ruff check problems diagnostics flake8 python",
      run: () => actions.updateSettings((s) => ({ ...s, lint: !s.lint })),
    },
    ...LANGUAGES.map((l) => ({
      id: `lang-${l.id}`,
      label: l.label,
      group: "Language",
      keywords: l.ext,
      run: () => actions.selectLang(l.id),
    })),
    ...THEMES.map((t) => ({
      id: `theme-${t.id}`,
      label: t.label,
      group: "Theme",
      run: () => actions.updateSettings((s) => ({ ...s, editorTheme: t.id })),
    })),
    ...TEXT_TOOLS.map((tool) => ({
      id: tool.id,
      label: tool.label,
      group: tool.group,
      keywords: tool.keywords,
      run: tool.modal
        ? () => actions.openToolModal(tool)
        : () =>
            actions.runTextUtil(tool.toast, (s) => tool.transform(s, settings), {
              useSelection: Boolean(tool.useSelection),
            }),
    })),
    // Data converters: the current input is read as `from`, whatever the
    // selected language, and the editor switches to `to`.
    ...CONVERSIONS.map((c) => ({
      id: c.id,
      label: `Convert ${c.label}`,
      group: "Convert",
      keywords: `convert ${c.from} ${c.to} data`,
      run: () => actions.convert(c),
    })),
    // Type generation from the JSON input, one entry per target.
    ...TYPEGEN_TARGETS.map((t) => ({
      id: `typegen-${t.id}`,
      label: `Generate ${t.label} ${t.noun} from JSON`,
      group: "Generate types",
      keywords: `generate types interface schema model codegen ${t.id} ${t.lang} json`,
      run: () => actions.generateTypes(t.id),
    })),
    // cURL command in the input → code, one entry per target.
    ...CURL_TARGETS.map((t) => ({
      id: `curl-${t.id}`,
      label: `Convert cURL to ${t.label}`,
      group: "cURL",
      keywords: `curl http request convert code ${t.id} ${t.lang} fetch axios python requests`,
      run: () => actions.convertCurl(t.id),
    })),
    // JSON Schema validation of the JSON input (Schema panel).
    {
      id: "schema-toggle",
      label: schemaOn ? "Turn off JSON Schema validation" : "Validate JSON against a schema",
      group: "JSON Schema",
      keywords: "json schema validate validation ajv draft-07 2020-12 errors",
      run: () => actions.toggleSchema(),
    },
    {
      id: "schema-generate",
      label: "Generate JSON Schema from JSON",
      group: "JSON Schema",
      keywords: "json schema infer generate create from sample",
      run: () => actions.generateSchema(),
    },
    {
      id: "tree-search",
      label: "Search JSON tree",
      group: "JSON",
      keywords: "find key value tree highlight jsonpath copy path filter",
      run: () => actions.searchTree(),
    },
    // Unique IDs inserted at the input cursor (or appended to the input).
    ...ID_KINDS.map((k) => ({
      id: `insert-${k.id}`,
      label: `Insert ${k.label}`,
      group: "Generate",
      keywords: `${k.id} uuid ulid guid id unique random generate`,
      run: () => actions.insertText(k.generate(), k.label),
    })),
    {
      id: "generate-ids",
      label: "Generate N UUIDs…",
      group: "Generate",
      keywords: "uuid v4 v7 ulid guid ids bulk many list generate",
      run: () => actions.openIdGenerator(),
    },
  ];
}
