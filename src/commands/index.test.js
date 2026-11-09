import { describe, it, expect, vi } from "vitest";
import { buildCommands } from "./index.js";
import { TEXT_TOOLS, jsonIndentFor, pythonIndentFor } from "./text-tools.js";
import { LANGUAGES } from "../languages/registry.js";
import { THEMES } from "../editor-themes.js";

function makeActions() {
  return {
    format: vi.fn(),
    share: vi.fn(),
    clearInput: vi.fn(),
    setViewMode: vi.fn(),
    toggleFullscreen: vi.fn(),
    copyOutput: vi.fn(),
    openSettings: vi.fn(),
    updateSettings: vi.fn(),
    selectLang: vi.fn(),
    runTextUtil: vi.fn(),
    openToolModal: vi.fn(),
  };
}

function build(overrides = {}) {
  const actions = makeActions();
  const commands = buildCommands({
    viewMode: "split",
    outputFullscreen: false,
    themeMode: "light",
    settings: { indent: 2 },
    actions,
    ...overrides,
  });
  const byId = Object.fromEntries(commands.map((c) => [c.id, c]));
  return { commands, byId, actions };
}

describe("buildCommands", () => {
  it("has unique ids and a run function on every command", () => {
    const { commands } = build();
    expect(new Set(commands.map((c) => c.id)).size).toBe(commands.length);
    for (const c of commands) expect(typeof c.run).toBe("function");
  });

  it("keeps the palette order: core, languages, themes, tools", () => {
    const { commands } = build();
    const core = ["format", "share", "clear", "diff", "compare", "fullscreen", "copy-output", "settings", "theme-flip", "lint-toggle"];
    expect(commands.slice(0, core.length).map((c) => c.id)).toEqual(core);
    expect(commands.map((c) => c.id)).toEqual([
      ...core,
      ...LANGUAGES.map((l) => `lang-${l.id}`),
      ...THEMES.map((t) => `theme-${t.id}`),
      ...TEXT_TOOLS.map((t) => t.id),
    ]);
  });

  it("labels toggles from current state", () => {
    expect(build().byId.diff.label).toBe("Switch to diff view");
    expect(build({ viewMode: "diff" }).byId.diff.label).toBe("Switch to split view");
    expect(build().byId.fullscreen.label).toBe("Fullscreen output");
    expect(build({ outputFullscreen: true }).byId.fullscreen.label).toBe("Exit fullscreen output");
    expect(build().byId["theme-flip"].label).toBe("Switch to dark theme");
    expect(build({ themeMode: "dark" }).byId["theme-flip"].label).toBe("Switch to light theme");
  });

  it("toggles diff view relative to the current mode", () => {
    const a = build();
    a.byId.diff.run();
    expect(a.actions.setViewMode).toHaveBeenCalledWith("diff");
    const b = build({ viewMode: "diff" });
    b.byId.diff.run();
    expect(b.actions.setViewMode).toHaveBeenCalledWith("split");
    b.byId.compare.run();
    expect(b.actions.setViewMode).toHaveBeenCalledWith("compare");
  });

  it("wires language and theme commands", () => {
    const { byId, actions } = build();
    byId["lang-json"].run();
    expect(actions.selectLang).toHaveBeenCalledWith("json");
    expect(byId["lang-json"]).toMatchObject({ group: "Language", keywords: "json" });

    byId["theme-dracula"].run();
    const update = actions.updateSettings.mock.calls[0][0];
    expect(update({ indent: 4, editorTheme: "x" })).toEqual({ indent: 4, editorTheme: "dracula" });
  });

  it("flips the editor theme to its opposite-mode sibling", () => {
    const { byId, actions } = build();
    byId["theme-flip"].run();
    const update = actions.updateSettings.mock.calls[0][0];
    expect(update({ editorTheme: "pretty-lush-light" }).editorTheme).toBe("pretty-lush-dark");
  });

  it("runs text transforms through runTextUtil with current settings", () => {
    const { byId, actions } = build({ settings: { indent: 4 } });
    byId["util-upper"].run();
    const [label, fn] = actions.runTextUtil.mock.calls[0];
    expect(label).toBe("Uppercase");
    expect(fn("abc")).toBe("ABC");

    byId["util-py-to-json"].run();
    const [, toJson] = actions.runTextUtil.mock.calls[1];
    expect(toJson("{'a': True}")).toBe('{\n    "a": true\n}\n');
  });

  it("toggles Ruff lint through updateSettings", () => {
    const off = build({ settings: { lint: false } });
    expect(off.byId["lint-toggle"].label).toBe("Turn on Python lint (Ruff)");
    off.byId["lint-toggle"].run();
    const update = off.actions.updateSettings.mock.calls[0][0];
    expect(update({ lint: false, indent: 2 })).toEqual({ lint: true, indent: 2 });
    expect(update({ lint: true })).toEqual({ lint: false });
    expect(build({ settings: { lint: true } }).byId["lint-toggle"].label).toBe(
      "Turn off Python lint (Ruff)"
    );
  });

  it("opens tool modals for modal tools", () => {
    const { byId, actions } = build();
    byId["util-jwt"].run();
    expect(actions.openToolModal).toHaveBeenCalledWith(
      expect.objectContaining({ id: "util-jwt", modal: "jwt", emptyMessage: "Paste a JWT first" })
    );
    expect(actions.runTextUtil).not.toHaveBeenCalled();
  });

  it("delegates simple commands to their actions", () => {
    const { byId, actions } = build();
    for (const [id, action] of [
      ["format", "format"],
      ["share", "share"],
      ["clear", "clearInput"],
      ["fullscreen", "toggleFullscreen"],
      ["copy-output", "copyOutput"],
      ["settings", "openSettings"],
    ]) {
      byId[id].run();
      expect(actions[action]).toHaveBeenCalledTimes(1);
    }
  });
});

describe("TEXT_TOOLS", () => {
  it("every tool is either a transform or a modal", () => {
    for (const t of TEXT_TOOLS) {
      expect(t.id).toMatch(/^util-/);
      if (t.modal) {
        expect(typeof t.decode).toBe("function");
        expect(t.emptyMessage).toBeTruthy();
      } else {
        expect(typeof t.transform).toBe("function");
        expect(t.toast).toBeTruthy();
      }
    }
  });
});

describe("indent helpers", () => {
  it("jsonIndentFor never yields tabs or zero", () => {
    expect(jsonIndentFor(2)).toBe(2);
    expect(jsonIndentFor(4)).toBe(4);
    expect(jsonIndentFor("tab")).toBe(2);
    expect(jsonIndentFor(0)).toBe(2);
    expect(jsonIndentFor(undefined)).toBe(2);
  });

  it("pythonIndentFor maps tabs to 4 spaces", () => {
    expect(pythonIndentFor(2)).toBe(2);
    expect(pythonIndentFor("tab")).toBe(4);
    expect(pythonIndentFor(undefined)).toBe(4);
  });
});
