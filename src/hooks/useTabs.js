import { useEffect, useMemo, useReducer, useRef } from "react";
import { STORAGE_KEYS, getStorage, writeJSON } from "../state/storage.js";
import { serializeWorkspace } from "../state/workspace.js";
import {
  canAddTab,
  getActiveTab,
  loadTabs,
  serializeTabs,
  tabLabels,
  tabsReducer,
} from "../state/tabs.js";

const SAVE_DELAY_MS = 500;

function persist(state) {
  writeJSON(STORAGE_KEYS.tabs, serializeTabs(state));
  // Mirror the active tab to the legacy single-workspace key: it stays a
  // valid fallback (and survives a rollback to a pre-tabs build).
  const active = getActiveTab(state);
  writeJSON(STORAGE_KEYS.workspace, serializeWorkspace(active.lang, active.inputs));
}

const PERSISTED_FIELDS = ["id", "name", "lang", "inputs", "jsonPath", "jsonView", "typegen", "curl"];

// Cheap identity check: the reducer only replaces what actually changed.
function persistedChanged(prev, next) {
  if (prev.activeId !== next.activeId || prev.seq !== next.seq) return true;
  if (prev.tabs.length !== next.tabs.length) return true;
  return next.tabs.some((t, i) => {
    const p = prev.tabs[i];
    return p !== t && PERSISTED_FIELDS.some((k) => p[k] !== t[k]);
  });
}

// Snippet tabs (see state/tabs.js), persisted with a debounce and flushed
// when the page is hidden. Besides the tab list and actions it exposes the
// active tab's fields plus setters bound to that tab's id *at render time*:
// an async format started in one tab still writes its result to that tab
// after the user switched to another one.
export function useTabs() {
  const [state, dispatch] = useReducer(tabsReducer, null, () => loadTabs(getStorage()));
  const active = getActiveTab(state);

  const latest = useRef(state);
  latest.current = state;
  const dirty = useRef(false);
  const saved = useRef(state);
  const timer = useRef(null);

  // Only changes to persisted fields (re)schedule a save, not output / errors.
  useEffect(() => {
    if (!persistedChanged(saved.current, state)) return;
    saved.current = state;
    dirty.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      dirty.current = false;
      persist(latest.current);
    }, SAVE_DELAY_MS);
  }, [state]);

  useEffect(() => {
    function flush() {
      clearTimeout(timer.current);
      if (!dirty.current) return;
      dirty.current = false;
      persist(latest.current);
    }
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  const labels = useMemo(() => tabLabels(state.tabs), [state.tabs]);

  const id = active.id;
  const bound = useMemo(() => {
    const setter = (key) => (value) => dispatch({ type: "update", id, key, value });
    return {
      setLang: setter("lang"),
      setInputs: setter("inputs"),
      setOutput: setter("output"),
      setError: setter("error"),
      setOutputFilter: setter("outputFilter"),
      setJsonPath: setter("jsonPath"),
      setJsonView: setter("jsonView"),
      setTypegen: setter("typegen"),
      setCurlState: setter("curl"),
    };
  }, [id]);

  return {
    state,
    dispatch,
    tabs: state.tabs,
    activeId: id,
    activeTab: active,
    labels,
    canAdd: canAddTab(state),
    closedCount: state.closed.length,
    lang: active.lang,
    inputs: active.inputs,
    output: active.output,
    error: active.error,
    outputFilter: active.outputFilter,
    jsonPath: active.jsonPath,
    jsonView: active.jsonView,
    typegen: active.typegen,
    curlState: active.curl,
    ...bound,
  };
}
