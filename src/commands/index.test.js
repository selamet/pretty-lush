import { describe, it, expect, vi } from "vitest";
import { buildCommands } from "./index.js";
import { TEXT_TOOLS, jsonIndentFor, pythonIndentFor } from "./text-tools.js";
import { LANGUAGES } from "../languages/registry.js";
import { THEMES } from "../editor-themes.js";
import { CONVERSIONS } from "../convert/index.js";
import { TYPEGEN_TARGETS } from "../codegen/index.js";
import { CURL_TARGETS } from "../curl/index.js";

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
    convert: vi.fn(),
    generateTypes: vi.fn(),
    convertCurl: vi.fn(),
    toggleSchema: vi.fn(),
    generateSchema: vi.fn(),
    searchTree: vi.fn(),
    insertText: vi.fn(),
    openIdGenerator: vi.fn(),
    importConfig: vi.fn(),
    switchProfile: vi.fn(),
    saveProfile: vi.fn(),
    newTab: vi.fn(),
    closeTab: vi.fn(),
    reopenTab: vi.fn(),
    renameTab: vi.fn(),
    switchTab: vi.fn(),
    cycleTab: vi.fn(),
    openBookmarklet: vi.fn(),
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

describe("buildCommands: tabs", () => {
  it("offers tab actions and a Go to tab command per tab", () => {
    const { byId, actions } = build({
      tabs: { list: [{ id: "t1", label: "JSON" }, { id: "t2", label: "Payload" }], activeId: "t2" },
    });
    for (const id of ["tab-new", "tab-close", "tab-reopen", "tab-rename"]) byId[id].run();
    expect(actions.newTab).toHaveBeenCalled();
    expect(actions.closeTab).toHaveBeenCalled();
    expect(actions.reopenTab).toHaveBeenCalled();
    expect(actions.renameTab).toHaveBeenCalled();
    expect(byId["tab-go-t1"].label).toBe("Go to tab: JSON");
    expect(byId["tab-go-t2"].label).toBe("Go to tab: Payload (active)");
    expect(byId["tab-go-t1"].shortcut).toBe("Alt+1");
    byId["tab-go-t1"].run();
    expect(actions.switchTab).toHaveBeenCalledWith("t1");
    byId["tab-prev"].run();
    expect(actions.cycleTab).toHaveBeenCalledWith(-1);
  });

  it("hides next / previous with a single tab", () => {
    const { byId } = build({ tabs: { list: [{ id: "t1", label: "JSON" }], activeId: "t1" } });
    expect(byId["tab-next"]).toBeUndefined();
    expect(byId["tab-go-t1"]).toBeDefined();
  });
});

describe("buildCommands", () => {
  it("has unique ids and a run function on every command", () => {
    const { commands } = build();
    expect(new Set(commands.map((c) => c.id)).size).toBe(commands.length);
    for (const c of commands) expect(typeof c.run).toBe("function");
  });

  it("keeps the palette order: core, languages, themes, tools, converters, typegen, schema", () => {
    const { commands } = build();
    const core = ["format", "share", "clear", "diff", "compare", "regex", "fullscreen", "copy-output", "settings", "theme-flip", "lint-toggle"];
    expect(commands.slice(0, core.length).map((c) => c.id)).toEqual(core);
    expect(commands.map((c) => c.id)).toEqual([
      ...core,
      "tab-new",
      "tab-close",
      "tab-reopen",
      "tab-rename",
      "bookmarklet",
      "import-config",
      "profile-save",
      ...LANGUAGES.map((l) => `lang-${l.id}`),
      ...THEMES.map((t) => `theme-${t.id}`),
      ...TEXT_TOOLS.map((t) => t.id),
      ...CONVERSIONS.map((c) => c.id),
      ...TYPEGEN_TARGETS.map((t) => `typegen-${t.id}`),
      ...CURL_TARGETS.map((t) => `curl-${t.id}`),
      "schema-toggle",
      "schema-generate",
      "tree-search",
      "insert-uuidv4",
      "insert-uuidv7",
      "insert-ulid",
      "generate-ids",
    ]);
  });

  it("adds config import, save-as-profile and one switch command per profile", () => {
    const { byId, actions } = build({
      profiles: { names: ["Default", "Work repo"], active: "Work repo" },
    });
    expect(byId["import-config"]).toMatchObject({
      label: "Import formatter config…",
      group: "Settings",
    });
    byId["import-config"].run();
    expect(actions.importConfig).toHaveBeenCalled();
    byId["profile-save"].run();
    expect(actions.saveProfile).toHaveBeenCalled();
    expect(byId["profile-Default"].label).toBe("Switch profile: Default");
    expect(byId["profile-Work repo"].label).toBe("Switch profile: Work repo (active)");
    byId["profile-Default"].run();
    expect(actions.switchProfile).toHaveBeenCalledWith("Default");
  });

  it("wires hash and ID generator commands", () => {
    const { byId, actions } = build();
    expect(byId["util-hash"]).toMatchObject({ label: "Hash input…", group: "Hash" });
    byId["util-hash"].run();
    const tool = actions.openToolModal.mock.calls[0][0];
    expect(tool).toMatchObject({ modal: "hash", useSelection: true });
    expect(tool.decode("abc", { source: "selection" })).toEqual({ text: "abc", source: "selection" });

    byId["insert-uuidv4"].run();
    byId["insert-uuidv7"].run();
    byId["insert-ulid"].run();
    const [[v4, v4Label], [v7, v7Label], [ul, ulLabel]] = actions.insertText.mock.calls;
    expect(v4).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(v4Label).toBe("UUID v4");
    expect(v7).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(v7Label).toBe("UUID v7");
    expect(ul).toMatch(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
    expect(ulLabel).toBe("ULID");

    byId["generate-ids"].run();
    expect(actions.openIdGenerator).toHaveBeenCalled();
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
    expect(b.byId.regex.label).toBe("Regex tester");
    b.byId.regex.run();
    expect(b.actions.setViewMode).toHaveBeenCalledWith("regex");
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

  it("runs case tools on the selection, other transforms on the whole input", () => {
    const { byId, actions } = build();
    byId["util-snake"].run();
    byId["util-upper"].run();
    byId["util-b64-enc"].run();
    const calls = actions.runTextUtil.mock.calls;
    expect(calls[0][0]).toBe("snake_case");
    expect(calls[0][1]("fooBar")).toBe("foo_bar");
    expect(calls[0][2]).toEqual({ useSelection: true });
    expect(calls[1][2]).toEqual({ useSelection: true });
    expect(calls[2][2]).toEqual({ useSelection: false });
  });

  it("registers every case conversion", () => {
    const { byId, actions } = build();
    const cases = {
      "util-camel": "userIdValue",
      "util-pascal": "UserIdValue",
      "util-snake": "user_id_value",
      "util-screaming-snake": "USER_ID_VALUE",
      "util-kebab": "user-id-value",
      "util-dot": "user.id.value",
      "util-sentence": "User id value",
    };
    for (const [id, expected] of Object.entries(cases)) {
      expect(byId[id].group).toBe("Text");
      byId[id].run();
      const [, fn] = actions.runTextUtil.mock.calls.at(-1);
      expect(fn("user ID_value")).toBe(expected);
    }
  });

  it("registers JSON minify / escape / unescape as palette transforms", () => {
    const { byId, actions } = build({ settings: { indent: 4 } });
    byId["util-json-minify"].run();
    byId["util-json-escape"].run();
    byId["util-json-unescape"].run();
    const [[minLabel, minify], [, escape], [, unescape]] = actions.runTextUtil.mock.calls;
    expect(minLabel).toBe("Minify");
    expect(minify('{ "a": [1, 2] }')).toEqual({ text: '{"a":[1,2]}', view: "code" });
    expect(escape('{"a":1}')).toBe('"{\\"a\\":1}"');
    expect(unescape('"{\\"a\\":1}"')).toEqual({
      text: '{\n    "a": 1\n}\n',
      lang: "json",
      depth: 1,
    });
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
        if (!t.allowEmpty) expect(t.emptyMessage).toBeTruthy();
      } else {
        expect(typeof t.transform).toBe("function");
        expect(t.toast).toBeTruthy();
      }
    }
  });
});

describe("Explain cron expression tool", () => {
  const tool = TEXT_TOOLS.find((t) => t.id === "util-cron");

  it("opens the cron modal even on an empty input", () => {
    expect(tool).toMatchObject({ modal: "cron", allowEmpty: true, useSelection: true });
    expect(tool.decode("", { source: "input", selection: "", cursorLine: "", input: "" })).toEqual({
      expression: "0 9 * * 1-5",
    });
  });

  it("prefills from the selection, the cursor line, then the input", () => {
    const input = "0 3 * * * backup.sh\n*/5 * * * * poll.sh";
    expect(tool.decode("@hourly", { selection: "@hourly", cursorLine: "", input }).expression).toBe("@hourly");
    expect(tool.decode(input, { selection: "", cursorLine: "*/5 * * * * poll.sh", input }).expression).toBe("*/5 * * * *");
    expect(tool.decode(input, { selection: "", cursorLine: "", input }).expression).toBe("0 3 * * *");
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

  it("adds a Convert command per direction that calls actions.convert", () => {
    const { byId, actions } = build();
    for (const id of ["json-yaml", "yaml-json", "json-toml", "toml-json", "json-csv", "csv-json"]) {
      expect(byId[`convert-${id}`].group).toBe("Convert");
    }
    expect(byId["convert-json-csv"].label).toBe("Convert JSON → CSV");
    byId["convert-csv-json"].run();
    expect(actions.convert).toHaveBeenCalledWith(
      expect.objectContaining({ from: "csv", to: "json" })
    );
  });

  it("adds a Generate types command per target that calls actions.generateTypes", () => {
    const { byId, actions } = build();
    expect(byId["typegen-typescript"].label).toBe("Generate TypeScript types from JSON");
    expect(byId["typegen-zod"].label).toBe("Generate Zod schema from JSON");
    expect(byId["typegen-pydantic"].label).toBe("Generate Pydantic models from JSON");
    for (const t of TYPEGEN_TARGETS) expect(byId[`typegen-${t.id}`].group).toBe("Generate types");
    byId["typegen-zod"].run();
    expect(actions.generateTypes).toHaveBeenCalledWith("zod");
  });

  it("adds a cURL command per target that calls actions.convertCurl", () => {
    const { byId, actions } = build();
    expect(byId["curl-fetch"].label).toBe("Convert cURL to fetch");
    expect(byId["curl-axios"].label).toBe("Convert cURL to axios");
    expect(byId["curl-requests"].label).toBe("Convert cURL to Python requests");
    for (const t of CURL_TARGETS) expect(byId[`curl-${t.id}`].group).toBe("cURL");
    byId["curl-requests"].run();
    expect(actions.convertCurl).toHaveBeenCalledWith("requests");
  });

  it("adds JSON Schema commands whose toggle label follows the state", () => {
    const off = build();
    expect(off.byId["schema-toggle"].label).toBe("Validate JSON against a schema");
    expect(off.byId["schema-generate"].label).toBe("Generate JSON Schema from JSON");
    off.byId["schema-toggle"].run();
    off.byId["schema-generate"].run();
    expect(off.actions.toggleSchema).toHaveBeenCalledTimes(1);
    expect(off.actions.generateSchema).toHaveBeenCalledTimes(1);
    const on = build({ schemaOn: true });
    expect(on.byId["schema-toggle"].label).toBe("Turn off JSON Schema validation");
  });

  it("adds a JSON tree search command", () => {
    const { byId, actions } = build();
    expect(byId["tree-search"].label).toBe("Search JSON tree");
    byId["tree-search"].run();
    expect(actions.searchTree).toHaveBeenCalledTimes(1);
  });

  it("adds an Install bookmarklet command", () => {
    const { byId, actions } = build();
    expect(byId.bookmarklet.label).toBe("Install bookmarklet");
    byId.bookmarklet.run();
    expect(actions.openBookmarklet).toHaveBeenCalledTimes(1);
  });
});
