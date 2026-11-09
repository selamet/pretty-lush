import { describe, it, expect } from "vitest";
import {
  MAX_CLOSED,
  MAX_TABS,
  MAX_TAB_NAME,
  canAddTab,
  createTab,
  getActiveTab,
  isPristine,
  loadTabs,
  migrateWorkspace,
  normalizeName,
  serializeTabs,
  tabLabels,
  tabsReducer,
} from "./tabs.js";
import { DEFAULT_LANG, MAX_INPUT_BYTES } from "./workspace.js";
import { STORAGE_KEYS } from "./storage.js";
import { SAMPLES } from "../languages/registry.js";
import { fakeStorage, throwingStorage } from "../test/fake-storage.js";

const stored = (entries) =>
  fakeStorage(Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, JSON.stringify(v)])));

function initial(lang = "json", input = "{}") {
  const tab = createTab(1, { lang, inputs: { [lang]: input } });
  return { tabs: [tab], activeId: tab.id, seq: 1, closed: [] };
}

function run(state, ...actions) {
  return actions.reduce(tabsReducer, state);
}

const ids = (s) => s.tabs.map((t) => t.id);

describe("createTab / helpers", () => {
  it("creates a tab with layered samples and an empty own input", () => {
    const t = createTab(3, { lang: "yaml" });
    expect(t).toMatchObject({ id: "t3", n: 3, name: null, lang: "yaml", jsonView: "tree", output: "" });
    expect(t.inputs.yaml).toBe("");
    expect(t.inputs.python).toBe(SAMPLES.python);
    expect(createTab(1, { lang: "cobol" }).lang).toBe(DEFAULT_LANG);
  });

  it("normalizes names", () => {
    expect(normalizeName("  my   api ")).toBe("my api");
    expect(normalizeName("   ")).toBeNull();
    expect(normalizeName(42)).toBeNull();
    expect(normalizeName("x".repeat(100))).toHaveLength(MAX_TAB_NAME);
  });

  it("detects pristine tabs", () => {
    expect(isPristine(createTab(1, { lang: "json" }))).toBe(true);
    expect(isPristine(createTab(1, { lang: "json", inputs: { json: SAMPLES.json } }))).toBe(true);
    expect(isPristine(createTab(1, { lang: "json", inputs: { json: "[1]" } }))).toBe(false);
    expect(isPristine({ ...createTab(1), name: "x" })).toBe(false);
  });

  it("labels unnamed tabs by language, numbered in creation order", () => {
    let s = initial("json");
    s = run(s, { type: "add", lang: "json" }, { type: "add", lang: "python" });
    s = run(s, { type: "move", id: "t2", to: 0 });
    const labels = tabLabels(s.tabs);
    expect(labels).toEqual({ t1: "JSON", t2: "JSON 2", t3: "Python" });
    s = run(s, { type: "rename", id: "t1", name: "Payload" });
    expect(tabLabels(s.tabs)).toEqual({ t1: "Payload", t2: "JSON", t3: "Python" });
  });
});

describe("tabsReducer: add / cap", () => {
  it("adds after the active tab and activates it", () => {
    let s = run(initial(), { type: "add" }, { type: "activate", id: "t1" }, { type: "add", lang: "css" });
    expect(ids(s)).toEqual(["t1", "t3", "t2"]);
    expect(s.activeId).toBe("t3");
    expect(getActiveTab(s).lang).toBe("css");
    expect(s.seq).toBe(3);
  });

  it("refuses to add beyond MAX_TABS", () => {
    let s = initial();
    for (let i = 0; i < MAX_TABS + 5; i++) s = tabsReducer(s, { type: "add" });
    expect(s.tabs).toHaveLength(MAX_TABS);
    expect(canAddTab(s)).toBe(false);
    expect(tabsReducer(s, { type: "add" })).toBe(s);
    expect(tabsReducer(s, { type: "duplicate", id: "t1" })).toBe(s);
  });

  it("duplicates a tab with its content and view state", () => {
    let s = run(
      initial("json", "[1,2]"),
      { type: "update", id: "t1", key: "jsonPath", value: "$[0]" },
      { type: "rename", id: "t1", name: "Data" },
      { type: "duplicate", id: "t1" }
    );
    const copy = getActiveTab(s);
    expect(ids(s)).toEqual(["t1", "t2"]);
    expect(copy).toMatchObject({ name: "Data copy", lang: "json", jsonPath: "$[0]" });
    expect(copy.inputs.json).toBe("[1,2]");
  });
});

describe("tabsReducer: close / undo", () => {
  it("activates the right neighbour, else the left one", () => {
    let s = run(initial(), { type: "add" }, { type: "add" }); // t1 t2 t3, active t3
    s = run(s, { type: "activate", id: "t2" }, { type: "close", id: "t2" });
    expect(ids(s)).toEqual(["t1", "t3"]);
    expect(s.activeId).toBe("t3");
    s = run(s, { type: "close", id: "t3" });
    expect(s.activeId).toBe("t1");
  });

  it("closing an inactive tab keeps the active one", () => {
    const s = run(initial(), { type: "add" }, { type: "close", id: "t1" });
    expect(s.activeId).toBe("t2");
  });

  it("closing the last tab leaves a fresh empty one", () => {
    const s = run(initial("yaml", "a: 1"), { type: "close", id: "t1" });
    expect(s.tabs).toHaveLength(1);
    expect(getActiveTab(s)).toMatchObject({ id: "t2", lang: "yaml" });
    expect(getActiveTab(s).inputs.yaml).toBe("");
  });

  it("reopens the last closed tab at its old position", () => {
    let s = run(initial("json", "[1]"), { type: "add" }, { type: "add" });
    s = run(s, { type: "update", id: "t2", key: "output", value: "x" });
    s = run(s, { type: "close", id: "t2" }, { type: "reopen" });
    expect(ids(s)).toEqual(["t1", "t2", "t3"]);
    expect(s.activeId).toBe("t2");
    expect(getActiveTab(s).output).toBe(""); // transient state is not kept
    expect(s.closed).toHaveLength(0);
    expect(tabsReducer(s, { type: "reopen" })).toBe(s);
  });

  it("reopening after closing the last tab replaces the untouched fresh tab", () => {
    const s = run(initial("json", "[1]"), { type: "close", id: "t1" }, { type: "reopen" });
    expect(ids(s)).toEqual(["t1"]);
    expect(getActiveTab(s).inputs.json).toBe("[1]");
  });

  it("keeps a bounded undo stack", () => {
    let s = initial();
    for (let i = 0; i < MAX_CLOSED + 4; i++) {
      s = run(s, { type: "add" });
      s = run(s, { type: "close", id: s.activeId });
    }
    expect(s.closed.length).toBe(MAX_CLOSED);
  });

  it("closes all other tabs", () => {
    const s = run(initial(), { type: "add" }, { type: "add" }, { type: "closeOthers", id: "t2" });
    expect(ids(s)).toEqual(["t2"]);
    expect(s.activeId).toBe("t2");
    expect(s.closed.map((c) => c.tab.id)).toEqual(["t1", "t3"]);
  });

  it("undoing close-others restores every tab in order, keeping a pristine survivor", () => {
    let s = run(initial("json", "[1]"), { type: "add" }, { type: "add", lang: "css", inputs: { css: "a{}" } });
    s = run(s, { type: "closeOthers", id: "t2" }, { type: "reopen" }, { type: "reopen" });
    expect(ids(s)).toEqual(["t1", "t2", "t3"]);
  });

  it("ignores unknown ids", () => {
    const s = initial();
    expect(tabsReducer(s, { type: "close", id: "nope" })).toBe(s);
    expect(tabsReducer(s, { type: "activate", id: "nope" })).toBe(s);
    expect(tabsReducer(s, { type: "update", id: "nope", key: "lang", value: "css" })).toBe(s);
  });
});

describe("tabsReducer: navigation / reorder / rename / update", () => {
  const three = () => run(initial(), { type: "add" }, { type: "add" }); // active t3

  it("cycles with wrap-around and activates by index", () => {
    let s = three();
    expect(run(s, { type: "cycle", delta: 1 }).activeId).toBe("t1");
    expect(run(s, { type: "cycle", delta: -1 }).activeId).toBe("t2");
    expect(run(s, { type: "activateIndex", index: 0 }).activeId).toBe("t1");
    expect(run(s, { type: "activateIndex", index: -1 }).activeId).toBe("t3");
    expect(run(s, { type: "activateIndex", index: 8 })).toBe(s);
  });

  it("moves tabs, clamped to the ends", () => {
    let s = three();
    expect(ids(run(s, { type: "move", id: "t3", to: 0 }))).toEqual(["t3", "t1", "t2"]);
    expect(ids(run(s, { type: "moveBy", id: "t1", delta: 1 }))).toEqual(["t2", "t1", "t3"]);
    expect(ids(run(s, { type: "moveBy", id: "t1", delta: -1 }))).toEqual(["t1", "t2", "t3"]);
    expect(run(s, { type: "move", id: "t3", to: 99 })).toBe(s);
  });

  it("renames, and an empty name restores the automatic label", () => {
    let s = run(initial(), { type: "rename", id: "t1", name: " API  response " });
    expect(getActiveTab(s).name).toBe("API response");
    s = run(s, { type: "rename", id: "t1", name: "" });
    expect(getActiveTab(s).name).toBeNull();
  });

  it("updates a field with a value or a function, without churn", () => {
    let s = initial("json", "[1]");
    s = run(s, { type: "update", id: "t1", key: "inputs", value: (p) => ({ ...p, json: "[2]" }) });
    expect(getActiveTab(s).inputs.json).toBe("[2]");
    expect(run(s, { type: "update", id: "t1", key: "lang", value: "json" })).toBe(s);
  });

  it("opens a snippet in the pristine active tab or a new one", () => {
    let s = { ...initial("json", ""), tabs: [createTab(1, { lang: "python" })] };
    s = run(s, { type: "openSnippet", lang: "yaml", input: "a: 1" });
    expect(ids(s)).toEqual(["t1"]);
    expect(getActiveTab(s)).toMatchObject({ lang: "yaml" });
    s = run(s, { type: "openSnippet", lang: "css", input: "a{}" });
    expect(ids(s)).toEqual(["t1", "t2"]);
    expect(getActiveTab(s).inputs.css).toBe("a{}");
    // Unknown language → the active tab's language.
    s = run(s, { type: "openSnippet", lang: "cobol", input: "b{}" });
    expect(getActiveTab(s)).toMatchObject({ id: "t3", lang: "css" });
  });
});

describe("loadTabs / migrate / serialize", () => {
  it("migrates the legacy single workspace into the first tab", () => {
    const storage = stored({ [STORAGE_KEYS.workspace]: { lang: "json", inputs: { json: "[1]", yaml: "a: 1" } } });
    const s = loadTabs(storage);
    expect(s.tabs).toHaveLength(1);
    expect(getActiveTab(s)).toMatchObject({ id: "t1", lang: "json", name: null });
    expect(getActiveTab(s).inputs).toMatchObject({ json: "[1]", yaml: "a: 1", python: SAMPLES.python });
    // The legacy key is left untouched.
    expect(storage.getItem(STORAGE_KEYS.workspace)).toContain("[1]");
  });

  it("starts with one default tab without any storage", () => {
    for (const storage of [fakeStorage(), throwingStorage, null]) {
      const s = loadTabs(storage);
      expect(s.tabs).toHaveLength(1);
      expect(getActiveTab(s).lang).toBe(DEFAULT_LANG);
      expect(getActiveTab(s).inputs[DEFAULT_LANG]).toBe(SAMPLES[DEFAULT_LANG]);
    }
  });

  it("prefers stored tabs and falls back to the legacy key when they are broken", () => {
    const legacy = { lang: "css", inputs: { css: "a{}" } };
    expect(getActiveTab(loadTabs(fakeStorage({
      [STORAGE_KEYS.tabs]: "{bad",
      [STORAGE_KEYS.workspace]: JSON.stringify(legacy),
    }))).lang).toBe("css");
    expect(getActiveTab(loadTabs(stored({
      [STORAGE_KEYS.tabs]: { tabs: [{ nope: 1 }] },
      [STORAGE_KEYS.workspace]: legacy,
    }))).lang).toBe("css");
  });

  it("round-trips tabs through serialize → load", () => {
    let s = run(
      migrateWorkspace(stored({ [STORAGE_KEYS.workspace]: { lang: "json", inputs: { json: "[1]" } } })),
      { type: "add", lang: "yaml", inputs: { yaml: "a: 1" } },
      { type: "rename", id: "t2", name: "Config" },
      { type: "update", id: "t2", key: "jsonView", value: "table" },
      { type: "update", id: "t2", key: "jsonPath", value: "$.a" },
      { type: "update", id: "t2", key: "typegen", value: (t) => ({ ...t, open: true, target: "zod" }) },
      { type: "update", id: "t2", key: "output", value: "formatted" },
      { type: "move", id: "t2", to: 0 }
    );
    const data = serializeTabs(s);
    expect(data.tabs[1].inputs).toEqual({ json: "[1]" }); // samples omitted
    expect(JSON.stringify(data)).not.toContain("formatted"); // output not persisted
    const back = loadTabs(stored({ [STORAGE_KEYS.tabs]: data }));
    expect(ids(back)).toEqual(["t2", "t1"]);
    expect(back.activeId).toBe("t2");
    expect(back.seq).toBe(2);
    expect(getActiveTab(back)).toMatchObject({
      name: "Config",
      lang: "yaml",
      jsonView: "table",
      jsonPath: "$.a",
      output: "",
      typegen: { open: false, target: "zod", rootName: "Root" },
    });
    expect(getActiveTab(back).inputs.yaml).toBe("a: 1");
    expect(getActiveTab(back).inputs.python).toBe(SAMPLES.python);
    // New ids continue after the stored sequence.
    expect(tabsReducer(back, { type: "add" }).activeId).toBe("t3");
  });

  it("sanitizes stored tabs", () => {
    const back = loadTabs(stored({
      [STORAGE_KEYS.tabs]: {
        activeId: "missing",
        tabs: [
          { id: "t5", lang: "cobol", jsonView: "weird", inputs: { json: 1, css: "a{}" } },
          { id: "t5", lang: "json" },
          { id: "t9", lang: "json", name: "  " },
        ],
      },
    }));
    expect(ids(back)).toEqual(["t5", "t9"]);
    expect(back.activeId).toBe("t5");
    expect(back.seq).toBe(9);
    expect(back.tabs[0]).toMatchObject({ lang: DEFAULT_LANG, jsonView: "tree" });
    expect(back.tabs[0].inputs.json).toBe(SAMPLES.json);
    expect(back.tabs[0].inputs.css).toBe("a{}");
    expect(back.tabs[1].name).toBeNull();
  });

  it("drops oversized inputs and keeps the active tab within the budget", () => {
    let s = run(initial("json", "x".repeat(60)), { type: "add", lang: "css", inputs: { css: "y".repeat(60) } });
    s = run(s, { type: "update", id: "t2", key: "inputs", value: (p) => ({ ...p, yaml: "z".repeat(MAX_INPUT_BYTES + 1) }) });
    const data = serializeTabs(s, { budget: 100 });
    expect(data.tabs.find((t) => t.id === "t2").inputs).toEqual({ css: "y".repeat(60) });
    expect(data.tabs.find((t) => t.id === "t1").inputs).toEqual({});
  });
});
