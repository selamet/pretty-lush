// Snippet tabs: a pure reducer plus load / serialize helpers.
//
// Each tab owns its language, per-language inputs (layered over the built-in
// samples, like the single workspace before tabs) and its output-pane view
// state (JSONPath filter, Code / Tree / Table, Types and cURL modes). The
// formatted output and errors are transient: kept in memory per tab, never
// persisted. Settings, profiles, Compare and Regex stay global.
//
// State shape: { tabs: Tab[], activeId, seq, closed: [{ tab, index }] }.
// Ids are derived from the monotonically increasing `seq` (persisted), so the
// reducer stays pure and ids never repeat across reloads.
import { STORAGE_KEYS } from "./storage.js";
import { DEFAULT_LANG, MAX_INPUT_BYTES, isKnownLang, loadWorkspace } from "./workspace.js";
import { LANGUAGES, SAMPLES } from "../languages/registry.js";
import { DEFAULT_ROOT_NAME } from "../codegen/index.js";

export const MAX_TABS = 20;
// Closed tabs kept for "Reopen closed tab" (session only).
export const MAX_CLOSED = 20; // = MAX_TABS, so "Close other tabs" is fully undoable
export const MAX_TAB_NAME = 40;
// Total characters of inputs persisted across all tabs (quota safety; the
// active tab is written first so it always survives).
export const MAX_TABS_STORAGE_CHARS = 1_500_000;

const JSON_VIEWS = ["tree", "code", "table"];

function defaultView() {
  return {
    jsonPath: "",
    jsonView: "tree",
    typegen: { open: false, target: "typescript", rootName: DEFAULT_ROOT_NAME },
    curl: { open: false, target: "fetch" },
  };
}

function transient() {
  return { output: "", error: null, outputFilter: null };
}

// A new tab. `inputs` are per-language overrides layered over the samples;
// by default the tab's own language starts empty.
export function createTab(seq, { lang = DEFAULT_LANG, inputs, name = null } = {}) {
  const safeLang = isKnownLang(lang) ? lang : DEFAULT_LANG;
  return {
    id: `t${seq}`,
    n: seq,
    name: normalizeName(name),
    lang: safeLang,
    inputs: { ...SAMPLES, ...(inputs || { [safeLang]: "" }) },
    ...defaultView(),
    ...transient(),
  };
}

export function normalizeName(name) {
  if (typeof name !== "string") return null;
  const trimmed = name.replace(/\s+/g, " ").trim().slice(0, MAX_TAB_NAME);
  return trimmed || null;
}

// True when a tab holds nothing the user typed: no custom name and every
// input is empty or a built-in sample. Pristine tabs are reused by share
// links and closed without an undo toast.
export function isPristine(tab) {
  if (!tab || tab.name) return false;
  return Object.keys(tab.inputs).every((k) => {
    const v = tab.inputs[k];
    return !v || !v.trim() || v === SAMPLES[k];
  });
}

export function canAddTab(state) {
  return state.tabs.length < MAX_TABS;
}

export function getActiveTab(state) {
  return state.tabs.find((t) => t.id === state.activeId) || state.tabs[0];
}

function langLabel(id) {
  return LANGUAGES.find((l) => l.id === id)?.label || id;
}

// Display labels by tab id. Named tabs show their name; unnamed ones show
// their language label, numbered in creation order when several tabs share
// a language ("JSON", "JSON 2", …).
export function tabLabels(tabs) {
  const byLang = new Map();
  for (const t of tabs) {
    if (t.name) continue;
    if (!byLang.has(t.lang)) byLang.set(t.lang, []);
    byLang.get(t.lang).push(t);
  }
  const labels = {};
  for (const t of tabs) {
    if (t.name) {
      labels[t.id] = t.name;
      continue;
    }
    const peers = byLang.get(t.lang).slice().sort((a, b) => a.n - b.n);
    const ordinal = peers.indexOf(t) + 1;
    labels[t.id] = ordinal > 1 ? `${langLabel(t.lang)} ${ordinal}` : langLabel(t.lang);
  }
  return labels;
}

function clampIndex(i, len) {
  return Math.max(0, Math.min(len - 1, i));
}

function insertAt(list, index, item) {
  const next = list.slice();
  next.splice(Math.max(0, Math.min(list.length, index)), 0, item);
  return next;
}

function moveTo(state, id, to) {
  const from = state.tabs.findIndex((t) => t.id === id);
  if (from < 0) return state;
  const target = clampIndex(to, state.tabs.length);
  if (target === from) return state;
  const tabs = state.tabs.slice();
  const [tab] = tabs.splice(from, 1);
  tabs.splice(target, 0, tab);
  return { ...state, tabs };
}

function addTab(state, opts, { activate = true, after = state.activeId } = {}) {
  if (!canAddTab(state)) return state;
  const seq = state.seq + 1;
  const tab = createTab(seq, opts);
  const afterIndex = state.tabs.findIndex((t) => t.id === after);
  const index = afterIndex < 0 ? state.tabs.length : afterIndex + 1;
  return {
    ...state,
    seq,
    tabs: insertAt(state.tabs, index, tab),
    activeId: activate ? tab.id : state.activeId,
  };
}

function closeTab(state, id) {
  const index = state.tabs.findIndex((t) => t.id === id);
  if (index < 0) return state;
  const closedTab = state.tabs[index];
  const entry = { tab: { ...closedTab, ...transient() }, index, replacedBy: null };
  let tabs = state.tabs.filter((t) => t.id !== id);
  let { seq, activeId } = state;
  if (tabs.length === 0) {
    // Closing the last tab leaves a fresh, empty one in the same language.
    seq += 1;
    const fresh = createTab(seq, { lang: closedTab.lang });
    tabs = [fresh];
    activeId = fresh.id;
    entry.replacedBy = fresh.id;
  } else if (activeId === id) {
    // Like browsers: activate the right neighbour, else the left one.
    activeId = tabs[Math.min(index, tabs.length - 1)].id;
  }
  const closed = [entry, ...state.closed].slice(0, MAX_CLOSED);
  return { ...state, tabs, activeId, seq, closed };
}

function reopenTab(state) {
  if (!state.closed.length || !canAddTab(state)) return state;
  const [{ tab, index, replacedBy }, ...closed] = state.closed;
  // The fresh tab created when the last tab was closed is dropped again
  // when it is still the only one and untouched.
  let tabs = state.tabs;
  if (tabs.length === 1 && tabs[0].id === replacedBy && isPristine(tabs[0])) tabs = [];
  const exists = tabs.some((t) => t.id === tab.id);
  let { seq } = state;
  let restored = tab;
  if (exists) {
    seq += 1;
    restored = { ...tab, id: `t${seq}`, n: seq };
  }
  return {
    ...state,
    seq,
    closed,
    tabs: insertAt(tabs, index, restored),
    activeId: restored.id,
  };
}

/**
 * Tabs reducer. Actions:
 *   add { lang?, inputs?, name? }      new tab after the active one, activated
 *   openSnippet { lang, input }        load a snippet (share link): reuses the
 *                                      active tab when pristine, else a new tab
 *   duplicate { id }
 *   close { id }                       pushes onto `closed` (undo)
 *   closeOthers { id }
 *   reopen                             restores the last closed tab
 *   activate { id } | activateIndex { index } (-1 = last) | cycle { delta }
 *   move { id, to } | moveBy { id, delta }
 *   rename { id, name }                empty name → automatic label
 *   update { id, key, value }          value may be a function of the old one
 * Adding beyond MAX_TABS returns the state unchanged (check `canAddTab`).
 */
export function tabsReducer(state, action) {
  switch (action.type) {
    case "add":
      return addTab(state, action);
    case "openSnippet": {
      const lang = isKnownLang(action.lang) ? action.lang : getActiveTab(state).lang;
      const active = getActiveTab(state);
      if (isPristine(active)) {
        return {
          ...state,
          tabs: state.tabs.map((t) =>
            t.id === active.id
              ? { ...t, lang, inputs: { ...t.inputs, [lang]: action.input }, ...transient() }
              : t
          ),
        };
      }
      return addTab(state, { lang, inputs: { [lang]: action.input } });
    }
    case "duplicate": {
      const src = state.tabs.find((t) => t.id === action.id);
      if (!src || !canAddTab(state)) return state;
      const next = addTab(state, { lang: src.lang, inputs: src.inputs }, { after: src.id });
      const copyName = src.name ? normalizeName(`${src.name} copy`) : null;
      return {
        ...next,
        tabs: next.tabs.map((t) =>
          t.id === next.activeId
            ? {
                ...t,
                name: copyName,
                jsonPath: src.jsonPath,
                jsonView: src.jsonView,
                typegen: { ...src.typegen },
                curl: { ...src.curl },
                output: src.output,
                error: src.error,
                outputFilter: src.outputFilter,
              }
            : t
        ),
      };
    }
    case "close":
      return closeTab(state, action.id);
    case "closeOthers": {
      if (!state.tabs.some((t) => t.id === action.id)) return state;
      let next = state;
      for (const t of state.tabs.slice().reverse()) {
        if (t.id !== action.id) next = closeTab(next, t.id);
      }
      return { ...next, activeId: action.id };
    }
    case "reopen":
      return reopenTab(state);
    case "activate":
      if (state.activeId === action.id || !state.tabs.some((t) => t.id === action.id)) {
        return state;
      }
      return { ...state, activeId: action.id };
    case "activateIndex": {
      const i = action.index < 0 ? state.tabs.length - 1 : action.index;
      const tab = state.tabs[i];
      return tab && tab.id !== state.activeId ? { ...state, activeId: tab.id } : state;
    }
    case "cycle": {
      const len = state.tabs.length;
      if (len < 2) return state;
      const i = state.tabs.findIndex((t) => t.id === state.activeId);
      const next = (((i + action.delta) % len) + len) % len;
      return { ...state, activeId: state.tabs[next].id };
    }
    case "move":
      return moveTo(state, action.id, action.to);
    case "moveBy": {
      const i = state.tabs.findIndex((t) => t.id === action.id);
      return i < 0 ? state : moveTo(state, action.id, i + action.delta);
    }
    case "rename":
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === action.id ? { ...t, name: normalizeName(action.name) } : t
        ),
      };
    case "update": {
      let changed = false;
      const tabs = state.tabs.map((t) => {
        if (t.id !== action.id) return t;
        const prev = t[action.key];
        const value = typeof action.value === "function" ? action.value(prev) : action.value;
        if (Object.is(prev, value)) return t;
        changed = true;
        return { ...t, [action.key]: value };
      });
      return changed ? { ...state, tabs } : state;
    }
    default:
      return state;
  }
}

function str(v, fallback) {
  return typeof v === "string" ? v : fallback;
}

// Restores one persisted tab, or null when it is unusable.
function reviveTab(raw) {
  if (!raw || typeof raw !== "object" || typeof raw.id !== "string" || !raw.id) return null;
  const n = Number.isFinite(raw.n) ? raw.n : Number(raw.id.slice(1)) || 0;
  const lang = isKnownLang(raw.lang) ? raw.lang : DEFAULT_LANG;
  const inputs = { ...SAMPLES };
  if (raw.inputs && typeof raw.inputs === "object") {
    for (const [k, v] of Object.entries(raw.inputs)) {
      if (typeof v === "string") inputs[k] = v;
    }
  }
  const view = defaultView();
  return {
    id: raw.id,
    n,
    name: normalizeName(raw.name),
    lang,
    inputs,
    jsonPath: str(raw.jsonPath, ""),
    jsonView: JSON_VIEWS.includes(raw.jsonView) ? raw.jsonView : view.jsonView,
    typegen: {
      open: false,
      target: str(raw.typegen?.target, view.typegen.target),
      rootName: str(raw.typegen?.rootName, view.typegen.rootName),
    },
    curl: { open: false, target: str(raw.curl?.target, view.curl.target) },
    ...transient(),
  };
}

function fromStoredTabs(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.tabs)) return null;
  const tabs = [];
  const seen = new Set();
  for (const raw of data.tabs.slice(0, MAX_TABS)) {
    const tab = reviveTab(raw);
    if (tab && !seen.has(tab.id)) {
      seen.add(tab.id);
      tabs.push(tab);
    }
  }
  if (!tabs.length) return null;
  const maxN = Math.max(...tabs.map((t) => t.n));
  const seq = Math.max(Number.isFinite(data.seq) ? data.seq : 0, maxN);
  const activeId = tabs.some((t) => t.id === data.activeId) ? data.activeId : tabs[0].id;
  return { tabs, activeId, seq, closed: [] };
}

// Wraps the pre-tabs single workspace (current language + per-language
// inputs) into one tab, so existing users keep what they had.
export function migrateWorkspace(storage) {
  const { lang, inputs } = loadWorkspace(storage);
  const tab = createTab(1, { lang, inputs });
  return { tabs: [tab], activeId: tab.id, seq: 1, closed: [] };
}

// Reads persisted tabs; falls back to (and migrates) the legacy workspace
// key when there are none or they are unreadable.
export function loadTabs(storage) {
  try {
    const raw = storage?.getItem(STORAGE_KEYS.tabs);
    if (raw) {
      const state = fromStoredTabs(JSON.parse(raw));
      if (state) return state;
    }
  } catch {
    // fall through to the legacy workspace
  }
  return migrateWorkspace(storage);
}

// Shape written to storage. Inputs equal to their sample are omitted (they
// are restored from the samples on load); oversized inputs are dropped, and
// once the total budget is spent remaining inputs are dropped too — the
// active tab (and its current language) first, so it always survives.
export function serializeTabs(state, { budget = MAX_TABS_STORAGE_CHARS } = {}) {
  let left = budget;
  const active = getActiveTab(state);
  const order = [active, ...state.tabs.filter((t) => t !== active)];
  const kept = new Map();
  for (const tab of order) {
    const inputs = {};
    const keys = [tab.lang, ...Object.keys(tab.inputs).filter((k) => k !== tab.lang)];
    for (const k of keys) {
      const v = tab.inputs[k] ?? "";
      if (v === SAMPLES[k] || v.length > MAX_INPUT_BYTES || v.length > left) continue;
      inputs[k] = v;
      left -= v.length;
    }
    kept.set(tab.id, inputs);
  }
  return {
    v: 1,
    activeId: active.id,
    seq: state.seq,
    tabs: state.tabs.map((t) => ({
      id: t.id,
      n: t.n,
      name: t.name,
      lang: t.lang,
      inputs: kept.get(t.id),
      jsonPath: t.jsonPath,
      jsonView: t.jsonView,
      typegen: { target: t.typegen.target, rootName: t.typegen.rootName },
      curl: { target: t.curl.target },
    })),
  };
}
