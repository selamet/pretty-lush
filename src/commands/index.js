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

/**
 * @param {object} ctx
 * @param {"split"|"diff"|"compare"} ctx.viewMode
 * @param {boolean} ctx.outputFullscreen
 * @param {"light"|"dark"} ctx.themeMode
 * @param {object} ctx.settings
 * @param {object} ctx.actions  format, share, clearInput, setViewMode,
 *   toggleFullscreen, copyOutput, openSettings, updateSettings(fn),
 *   selectLang(id), runTextUtil(label, fn), openToolModal(tool)
 */
export function buildCommands({
  viewMode,
  outputFullscreen,
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
        : () => actions.runTextUtil(tool.toast, (s) => tool.transform(s, settings)),
    })),
  ];
}
