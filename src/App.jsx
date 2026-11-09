import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { EditorSelection } from "@codemirror/state";
import { formatCode } from "./formatters/index.js";
import { FORMAT_LABELS, conversionsFrom, convertData } from "./convert/index.js";
import {
  DEFAULT_ROOT_NAME,
  generateTypes,
  getTypegenTarget,
} from "./codegen/index.js";
import { convertCurl, getCurlTarget, looksLikeCurl } from "./curl/index.js";
import CommandPalette from "./components/CommandPalette.jsx";
import ShareDialog, { PasswordPrompt } from "./components/ShareDialog.jsx";
import ImportConfigDialog from "./components/ImportConfigDialog.jsx";
import ToolModalHost from "./components/ToolModalHost.jsx";
import Toast from "./components/Toast.jsx";
import DropOverlay from "./components/DropOverlay.jsx";
import TopBar from "./components/TopBar.jsx";
import Toolbar from "./components/Toolbar.jsx";
import SuggestionBanner from "./components/SuggestionBanner.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Resizer from "./components/Resizer.jsx";
import DiffPane from "./components/DiffPane.jsx";
import ComparePanes from "./components/ComparePanes.jsx";
import RegexPanes from "./components/RegexPanes.jsx";
import InputPane from "./components/InputPane.jsx";
import OutputPane from "./components/OutputPane.jsx";
import StatusBar from "./components/StatusBar.jsx";
import { buildCommands } from "./commands/index.js";
import { TEXT_TOOLS } from "./commands/text-tools.js";
import { flipTheme } from "./editor-themes.js";
import { SAMPLES } from "./languages/registry.js";
import { getLanguage } from "./languages/groups.js";
import { detectLangFromFilename } from "./languages/detect.js";
import { MAX_INPUT_BYTES } from "./state/workspace.js";
import { MAX_HISTORY_ITEM, createHistoryEntry } from "./state/history.js";
import {
  RESIZER_PX,
  clampSidebarWidth,
  inputFrFromDrag,
  inputPxFromFr,
} from "./state/layout.js";
import {
  toJsonTable,
  toJsonTree,
  resolveOutputView,
} from "./output/json-views.js";
import { jsonPathResultBases } from "./output/json-filter.js";
import { useSettings } from "./hooks/useSettings.js";
import { useProfiles } from "./hooks/useProfiles.js";
import { FORMAT_SETTING_KEYS } from "./state/settings.js";
import { useHistory } from "./hooks/useHistory.js";
import { useLayout } from "./hooks/useLayout.js";
import { useWorkspace } from "./hooks/useWorkspace.js";
import { useCompareSnippets } from "./hooks/useCompareSnippets.js";
import { useRegexTester } from "./hooks/useRegexTester.js";
import { useToast } from "./hooks/useToast.js";
import { useShare } from "./hooks/useShare.js";
import { useLanguageSuggestion } from "./hooks/useLanguageSuggestion.js";
import { useCurlSuggestion } from "./hooks/useCurlSuggestion.js";
import { useFileDrop } from "./hooks/useFileDrop.js";
import { useWindowKeydown } from "./hooks/useWindowKeydown.js";
import { useRuffLint } from "./hooks/useRuffLint.js";
import { useSchemaState, useSchemaValidation } from "./hooks/useSchemaValidation.js";
import { parseJsonText } from "./schema/validate.js";
import { generateSchemaText } from "./schema/generate.js";
import {
  hasShareHash,
  pathForLang,
  routeForPath,
  titleForLang,
} from "./seo/routes.js";

// App shell: owns the formatting state (input → output / error) and wires
// hooks (persisted state, sharing, detection) to the layout components.
// Persisted state lives in src/hooks/, pure logic in src/state/,
// ⌘K commands in src/commands/, UI pieces in src/components/.
export default function App() {
  const { lang, setLang, inputs, setInputs } = useWorkspace();
  const [output, setOutput] = useState("");
  const [error, setError] = useState(null);
  const [isFormatting, setIsFormatting] = useState(false);
  const { settings, setSettings, themeMeta } = useSettings();
  // false | true | "save" ("save" opens the popover's save-as-profile input).
  const [settingsOpen, setSettingsOpen] = useState(false);
  const profiles = useProfiles(settings, setSettings);
  const [importOpen, setImportOpen] = useState(false);
  // Changes whenever any option that shapes formatter output changes.
  const formatSettingsKey = FORMAT_SETTING_KEYS.map((k) => settings[k]).join("|");
  const [viewMode, setViewMode] = useState("split"); // "split" | "diff" | "compare" | "regex"
  const compare = useCompareSnippets();
  const [toast, setToast] = useToast();
  const { history, pushHistory, clearHistory } = useHistory();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [layout, setLayout] = useLayout();
  const editorRef = useRef(null);
  const [jsonPath, setJsonPath] = useState("");
  const [jsonView, setJsonView] = useState("tree"); // 'tree' | 'code' | 'table'
  // JSONPath filter behind the current output: { output, expression, bases },
  // so the tree can map nodes of filtered output back to input paths.
  const [outputFilter, setOutputFilter] = useState(null);
  const [treeSearchRequested, setTreeSearchRequested] = useState(false);
  const clearTreeSearchRequest = useCallback(() => setTreeSearchRequested(false), []);
  const [toolModal, setToolModal] = useState(null); // { id, result } | null
  // Input editor (CodeMirror view) of the split view, for selection-aware
  // tools and "insert at cursor". `inputEditorUsed` is set once the user
  // focuses that editor, so its cursor is a place they actually chose.
  const inputViewRef = useRef(null);
  const inputEditorUsed = useRef(false);
  const [outputFullscreen, setOutputFullscreen] = useState(false);
  // "Generate types" mode of the output pane (JSON input only).
  const [typegen, setTypegen] = useState({
    open: false,
    target: "typescript",
    rootName: DEFAULT_ROOT_NAME,
  });
  // "cURL → code" mode of the output pane (input is a cURL command).
  const [curlState, setCurlState] = useState({ open: false, target: "fetch" });

  // Landing page the app was opened on (/json-formatter, /regex-tester, …).
  // A share link (#s= / #p=) wins: it picks its own language.
  const [initialRoute] = useState(() =>
    hasShareHash(window.location.hash) ? null : routeForPath(window.location.pathname)
  );

  const input = inputs[lang] ?? "";
  const currentLang = getLanguage(lang);
  // Regex tester view: its test text is seeded from the input on first open.
  const regex = useRegexTester({ active: viewMode === "regex", seed: input });
  // Ruff lint runs on its own debounce, never inside handleFormat.
  const lint = useRuffLint({
    enabled: settings.lint && lang === "python" && viewMode === "split",
    input,
    settings,
  });

  // JSON Schema validation of the input (Schema panel in the input pane).
  // Independent of the output pane: it stays on alongside Types / Tree /
  // Table and across Format; it is only hidden (not turned off) while the
  // input isn't JSON (e.g. after Convert → YAML) or outside split view.
  const [schemaState, setSchemaState] = useSchemaState();
  const schemaActive = schemaState.open && lang === "json" && viewMode === "split";
  const schemaValidation = useSchemaValidation({
    enabled: schemaActive,
    input,
    schemaText: schemaState.text,
  });

  function setInput(text) {
    setInputs((prev) => ({ ...prev, [lang]: text }));
  }

  const share = useShare({
    lang,
    input,
    setLang,
    setInputs,
    setOutput,
    setError,
    notify: setToast,
  });
  const { suggestion, setSuggestion, dismissSuggestion } =
    useLanguageSuggestion(input, lang);

  useWindowKeydown((e) => {
    if (e.key === "Escape") setOutputFullscreen(false);
  }, outputFullscreen);

  useWindowKeydown((e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      setPaletteOpen((v) => !v);
    }
  });

  const jsonTableData = useMemo(
    () => (lang === "json" ? toJsonTable(output) : null),
    [lang, output]
  );
  const jsonTreeData = useMemo(
    () => (lang === "json" ? toJsonTree(output) : null),
    [lang, output]
  );
  const outputView = resolveOutputView(jsonView, {
    tree: jsonTreeData,
    table: jsonTableData,
  });

  // Generated types follow the input live; the deferred value keeps typing
  // responsive on large samples.
  const typegenActive = typegen.open && lang === "json" && viewMode === "split";
  const typegenInput = useDeferredValue(input);
  const typegenView = useMemo(() => {
    if (!typegenActive) return null;
    const view = { target: typegen.target, rootName: typegen.rootName, code: "", error: null };
    try {
      view.code = generateTypes(typegen.target, typegenInput, {
        rootName: typegen.rootName,
      });
    } catch (e) {
      view.error = {
        title: "Couldn’t generate types",
        message: e.message,
        line: e.line ?? null,
        column: e.column ?? null,
        hint: e.hint ?? null,
      };
    }
    return view;
  }, [typegenActive, typegen.target, typegen.rootName, typegenInput]);

  function openTypegen(target) {
    if (lang !== "json") {
      setToast({ kind: "warn", message: "Generate types needs JSON input — switch to JSON first" });
      return;
    }
    setViewMode("split");
    closeCurl();
    setTypegen((t) => ({ ...t, open: true, target: target || t.target }));
    if (target) {
      setToast({ kind: "ok", message: `Generating ${getTypegenTarget(target).label} from JSON` });
    }
  }

  function closeTypegen() {
    setTypegen((t) => (t.open ? { ...t, open: false } : t));
  }

  // cURL → fetch / axios / requests follows the input live, like types.
  // Available whatever the selected language, as long as the input starts
  // with `curl`.
  const curlAvailable = looksLikeCurl(input);
  const curlActive = curlState.open && curlAvailable && viewMode === "split";
  const curlInput = useDeferredValue(input);
  const curlView = useMemo(() => {
    if (!curlActive) return null;
    const view = { target: curlState.target, code: "", warnings: [], error: null };
    try {
      Object.assign(view, convertCurl(curlState.target, curlInput));
    } catch (e) {
      view.error = {
        title: "Couldn’t convert the cURL command",
        message: e.message,
        line: null,
        column: null,
        hint: e.hint ?? null,
      };
    }
    return view;
  }, [curlActive, curlState.target, curlInput]);
  const { curlSuggestion, dismissCurlSuggestion } = useCurlSuggestion(
    input,
    viewMode === "split" && !curlActive
  );

  function openCurl(target) {
    if (!looksLikeCurl(input)) {
      setToast({ kind: "warn", message: "Paste a cURL command first — it should start with “curl”" });
      return;
    }
    setViewMode("split");
    closeTypegen();
    dismissCurlSuggestion();
    setCurlState((c) => ({ ...c, open: true, target: target || c.target }));
    if (target) {
      setToast({ kind: "ok", message: `Converting cURL to ${getCurlTarget(target).label}` });
    }
  }

  function closeCurl() {
    setCurlState((c) => (c.open ? { ...c, open: false } : c));
  }

  function requireJson(what) {
    if (lang === "json") return true;
    setToast({ kind: "warn", message: `${what} needs JSON input — switch to JSON first` });
    return false;
  }

  function toggleSchema() {
    if (schemaActive) {
      setSchemaState((s) => ({ ...s, open: false }));
      return;
    }
    if (!requireJson("Schema validation")) return;
    setViewMode("split");
    setSchemaState((s) => ({ ...s, open: true }));
  }

  // Replaces the schema with one inferred from the JSON input (same merge
  // rules as Generate types) and turns validation on.
  function generateSchemaFromInput() {
    if (!requireJson("Generate schema")) return;
    if (!input.trim()) {
      setToast({ kind: "warn", message: "Input is empty" });
      return;
    }
    let value;
    try {
      value = parseJsonText(input, "Input");
    } catch (e) {
      setToast({ kind: "warn", message: e.message });
      return;
    }
    const text = generateSchemaText(value, settings.indent);
    setViewMode("split");
    setSchemaState({ open: true, text });
    setToast({ kind: "ok", message: "Schema generated from JSON" });
  }

  // Runs a ⌘K text transform (src/commands/text-tools.js) on the input. A
  // one-shot output transform: the output is not re-formatted until the
  // input or settings change (auto-format only reacts to those).
  // Applies a string transform to every non-empty selection range of the
  // input editor, in place (one undoable change; the results stay
  // selected). Returns false when there is no selection to work on.
  function transformInputSelection(label, fn) {
    const view = inputView();
    if (!view || view.state.selection.ranges.every((r) => r.empty)) return false;
    let tr;
    try {
      tr = view.state.changeByRange((range) => {
        if (range.empty) return { range };
        const insert = fn(view.state.sliceDoc(range.from, range.to));
        if (typeof insert !== "string") throw new Error(`${label} can't be applied to a selection`);
        return {
          changes: { from: range.from, to: range.to, insert },
          range: EditorSelection.range(range.from, range.from + insert.length),
        };
      });
    } catch (e) {
      setToast({ kind: "warn", message: e.message });
      return true;
    }
    view.dispatch(tr, { scrollIntoView: true, userEvent: "input.transform" });
    view.focus();
    setToast({ kind: "ok", message: `${label} applied to selection` });
    return true;
  }

  function runTextUtil(label, fn, { useSelection = false } = {}) {
    if (useSelection && transformInputSelection(label, fn)) return;
    if (!input) {
      setToast({ kind: "warn", message: "Input is empty" });
      return;
    }
    let result;
    try {
      result = fn(input);
    } catch (e) {
      setError({
        message: e.message,
        line: e.line ?? null,
        column: e.column ?? null,
        hint: e.hint ?? null,
      });
      setOutput("");
      return;
    }
    const { text, lang: resultLang = null, view = null } =
      typeof result === "string" ? { text: result } : result;
    if (resultLang) {
      adoptAsInput(resultLang, text);
      if (resultLang !== lang) {
        setToast({
          kind: "ok",
          message: `${label} applied · switched to ${getLanguage(resultLang).label} · previous input saved in Recent`,
        });
        return;
      }
    } else {
      setOutput(text);
      setError(null);
    }
    if (view) setJsonView(view);
    setToast({ kind: "ok", message: `${label} applied` });
  }

  // Toolbar "Minify" (JSON): same one-shot transform as the ⌘K command.
  function handleMinify() {
    const tool = TEXT_TOOLS.find((t) => t.id === "util-json-minify");
    runTextUtil(tool.toast, (s) => tool.transform(s, settings));
  }

  // The live input editor, or null outside split view (its view is destroyed).
  function inputView() {
    const view = inputViewRef.current;
    return viewMode === "split" && view && !view.destroyed ? view : null;
  }

  // Text of the input editor's (main) selection, or "" when nothing is selected.
  function inputSelectionText() {
    const view = inputView();
    if (!view) return "";
    const { from, to } = view.state.selection.main;
    return view.state.sliceDoc(from, to);
  }

  // Puts generated text (an ID, a list of IDs) into the input: at the cursor
  // (replacing the selection) when the input editor has been used, else it
  // replaces an empty input or is appended on a new line.
  function insertIntoInput(text, label) {
    const view = inputView();
    if (view && inputEditorUsed.current) {
      view.dispatch(view.state.replaceSelection(text));
      view.focus();
      setToast({ kind: "ok", message: `Inserted ${label}` });
      return;
    }
    if (!input.trim()) {
      setInput(text);
      setToast({ kind: "ok", message: `Inserted ${label}` });
      return;
    }
    setInput(input.endsWith("\n") ? input + text : `${input}\n${text}`);
    setToast({ kind: "ok", message: `Appended ${label} to the input` });
  }

  // Text of the input line under the cursor, or "" outside split view.
  function inputCursorLine() {
    const view = inputView();
    if (!view) return "";
    return view.state.doc.lineAt(view.state.selection.main.head).text;
  }

  function openToolModal(tool) {
    const selection = tool.useSelection ? inputSelectionText() : "";
    const text = selection || input;
    if (!text && !tool.allowEmpty) {
      setToast({ kind: "warn", message: tool.emptyMessage });
      return;
    }
    try {
      setToolModal({
        id: tool.modal,
        result: tool.decode(text, {
          source: selection ? "selection" : "input",
          selection,
          cursorLine: inputCursorLine(),
          input,
        }),
      });
      setError(null);
    } catch (e) {
      setError({ message: e.message, line: null, column: null, hint: null });
      setOutput("");
    }
  }

  // Switches the editor to `to` and puts `result` in both panes. The current
  // input (and any input `to` had) is pushed to the Recent history first, so
  // the change can be undone from the sidebar.
  function adoptAsInput(to, result) {
    const remember = (l, text) => {
      if (text && text.trim() && text.length <= MAX_HISTORY_ITEM) {
        pushHistory(createHistoryEntry({ lang: l, input: text, output: text }));
      }
    };
    const previousTarget = inputs[to];
    if (to !== lang && previousTarget !== SAMPLES[to] && previousTarget !== result) {
      remember(to, previousTarget);
    }
    remember(lang, input);
    closeTypegen();
    setLang(to);
    setInputs((prev) => ({ ...prev, [to]: result }));
    setOutput(result);
    setError(null);
    setSuggestion(null);
    if (to !== "json") {
      setJsonPath("");
      setJsonView("code");
    }
  }

  // Converts the current input from one data format to another, switches the
  // editor to the target language and puts the result in both panes. The
  // source input (and any input the target language had) is pushed to the
  // Recent history first, so the conversion can be undone from the sidebar.
  async function handleConvert({ from, to }) {
    if (!input.trim()) {
      setToast({ kind: "warn", message: "Input is empty" });
      return;
    }
    let result;
    try {
      result = await convertData(from, to, input, { indent: settings.indent });
    } catch (e) {
      setError({
        title: "Couldn’t convert",
        message: e.message,
        line: e.line ?? null,
        column: e.column ?? null,
        hint: e.hint ?? null,
      });
      setOutput("");
      return;
    }
    adoptAsInput(to, result);
    setToast({
      kind: "ok",
      message: `Converted ${FORMAT_LABELS[from]} → ${FORMAT_LABELS[to]} · previous input saved in Recent`,
    });
  }

  function restoreFromHistory(entry) {
    closeTypegen();
    setLang(entry.lang);
    setInputs((prev) => ({ ...prev, [entry.lang]: entry.input }));
    setOutput("");
    setError(null);
    setSuggestion(null);
  }

  // `jsonPathOverride` formats with that filter instead of the (possibly not
  // yet re-rendered) `jsonPath` state. Resolves to true on success.
  async function handleFormat({ silent = false, jsonPath: jsonPathOverride } = {}) {
    if (isFormatting) return false;
    if (!silent) {
      setIsFormatting(true);
      closeTypegen();
      closeCurl();
    }
    const filterExpr = lang === "json" ? (jsonPathOverride ?? jsonPath).trim() : "";
    try {
      const result = await formatCode(lang, input, {
        ...settings,
        jsonPath: filterExpr || null,
      });
      let filterInfo = null;
      if (filterExpr) {
        let bases = [];
        try {
          bases = await jsonPathResultBases(JSON.parse(input), filterExpr);
        } catch {
          // Paths in the tree then fall back to the filtered output.
        }
        filterInfo = { output: result, expression: filterExpr, bases };
      }
      setOutputFilter(filterInfo);
      setOutput(result);
      setError(null);
      if (!silent && input.length <= MAX_HISTORY_ITEM) {
        pushHistory(createHistoryEntry({ lang, input, output: result }));
      }
      return true;
    } catch (e) {
      if (silent) {
        // suppress error during auto-format typing — keep last good output
        return false;
      }
      setError({
        message: e.message,
        line: e.line ?? null,
        column: e.column ?? null,
        hint: e.hint ?? null,
      });
      setOutput("");
      return false;
    } finally {
      if (!silent) setIsFormatting(false);
    }
  }

  // "Filter by this path" from the JSON tree: set the JSONPath filter and
  // apply it right away.
  async function filterByJsonPath(path) {
    setJsonPath(path);
    if (await handleFormat({ jsonPath: path })) {
      setToast({ kind: "ok", message: `Filtered by ${path}` });
    }
  }

  function searchJsonTree() {
    if (lang !== "json" || !jsonTreeData || viewMode !== "split") {
      setToast({ kind: "warn", message: "Format some JSON first to search its tree" });
      return;
    }
    closeTypegen();
    setJsonView("tree");
    setTreeSearchRequested(true);
  }

  useEffect(() => {
    if (!settings.autoFormat) return;
    if (!input.trim()) return;
    const t = setTimeout(() => {
      handleFormat({ silent: true });
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, lang, settings.autoFormat, formatSettingsKey]);

  function handleSelectLang(id) {
    if (id !== lang) closeTypegen();
    setLang(id);
    setInputs((prev) =>
      prev[id] !== undefined ? prev : { ...prev, [id]: SAMPLES[id] || "" }
    );
    setOutput("");
    setError(null);
    setSuggestion(null);
    if (id !== "json") {
      setJsonPath("");
      setJsonView("code");
    }
  }

  // Preselects what a landing route is about: its language, then its view or
  // tool. Called once on mount and from the "Popular tools" links.
  function applyLandingRoute(route) {
    if (route.lang) handleSelectLang(route.lang);
    if (route.kind === "language") setViewMode("split");
    switch (route.tool) {
      case "regex":
        setViewMode("regex");
        break;
      case "typegen-typescript":
        setViewMode("split");
        closeCurl();
        setTypegen((t) => ({ ...t, open: true, target: "typescript" }));
        break;
      case "schema":
        setViewMode("split");
        setSchemaState((s) => ({ ...s, open: true }));
        break;
      case "curl":
        setViewMode("split");
        closeTypegen();
        setInputs((prev) =>
          !prev.shell?.trim() || prev.shell === SAMPLES.shell
            ? { ...prev, shell: route.sample }
            : prev
        );
        setCurlState((c) => ({ ...c, open: true }));
        break;
      case "jwt": {
        const tool = TEXT_TOOLS.find((t) => t.id === "util-jwt");
        try {
          setToolModal({ id: tool.modal, result: tool.decode(input) });
        } catch {
          setToast({ kind: "ok", message: "Paste a JWT into the input, then ⌘K → “Decode JWT”" });
        }
        break;
      }
      case "cron": {
        const tool = TEXT_TOOLS.find((t) => t.id === "util-cron");
        setToolModal({
          id: tool.modal,
          result: tool.decode(input, { source: "input", selection: "", cursorLine: "", input }),
        });
        break;
      }
      default:
        break;
    }
  }

  // "Popular tools" link: same as opening that page, without a reload.
  function openLandingRoute(route) {
    window.history.replaceState(null, "", route.path);
    document.title = route.title;
    applyLandingRoute(route);
  }

  useEffect(() => {
    if (!initialRoute) return;
    document.title = initialRoute.title;
    applyLandingRoute(initialRoute);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keeps the URL and title on the current language's landing page when the
  // language changes (sidebar, palette, convert, share link…). A tool page
  // for the same language (/json-to-typescript) is left as it is; the
  // initial language is never rewritten, so `/` stays `/` on load.
  const urlSyncReady = useRef(false);
  useEffect(() => {
    if (!urlSyncReady.current) {
      urlSyncReady.current = true;
      return;
    }
    const current = routeForPath(window.location.pathname);
    if (current && current.lang === lang) return;
    const path = pathForLang(lang);
    if (path !== window.location.pathname) {
      const { search, hash } = window.location;
      window.history.replaceState(window.history.state, "", path + search + hash);
    }
    document.title = titleForLang(lang);
  }, [lang]);

  function handleKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleFormat();
    }
  }

  async function loadDroppedFile(file) {
    if (file.size > MAX_INPUT_BYTES * 5) {
      setError({
        message: `File too large (${(file.size / 1024).toFixed(0)} KB). Max ${MAX_INPUT_BYTES / 1000} KB.`,
        line: null,
        column: null,
        hint: null,
      });
      return;
    }
    const text = await file.text();
    const detected = detectLangFromFilename(file.name);
    if (detected) handleSelectLang(detected);
    setInputs((prev) => ({ ...prev, [detected || lang]: text }));
    setOutput("");
    setError(null);
  }

  const { isDragging, dropHandlers } = useFileDrop(loadDroppedFile);

  function toggleTheme() {
    setSettings((s) => ({ ...s, editorTheme: flipTheme(s.editorTheme) }));
  }

  const commands = buildCommands({
    viewMode,
    outputFullscreen,
    schemaOn: schemaActive,
    themeMode: themeMeta.mode,
    settings,
    actions: {
      format: () => handleFormat(),
      share: share.openShareDialog,
      clearInput: () => {
        setInput("");
        setOutput("");
        setError(null);
      },
      setViewMode,
      toggleFullscreen: () => setOutputFullscreen((v) => !v),
      copyOutput: () => {
        const text = curlView ? curlView.code : typegenView ? typegenView.code : output;
        if (text) navigator.clipboard.writeText(text);
      },
      openSettings: () => setSettingsOpen(true),
      updateSettings: setSettings,
      selectLang: handleSelectLang,
      runTextUtil,
      openToolModal,
      insertText: insertIntoInput,
      openIdGenerator: () => setToolModal({ id: "ids", result: {} }),
      convert: handleConvert,
      generateTypes: openTypegen,
      convertCurl: openCurl,
      toggleSchema,
      generateSchema: generateSchemaFromInput,
      searchTree: searchJsonTree,
      importConfig: () => setImportOpen(true),
      switchProfile: (name) => {
        profiles.switchTo(name);
        setToast({ kind: "ok", message: `Switched to profile "${name}"` });
      },
      saveProfile: () => setSettingsOpen("save"),
    },
    profiles: { names: profiles.names, active: profiles.active },
  });

  function applyImportedConfig(result) {
    setSettings((s) => ({ ...s, ...result.patch }));
    setImportOpen(false);
    const n = result.applied.length;
    setToast({
      kind: "ok",
      message: `Imported ${n} ${n === 1 ? "option" : "options"} into "${profiles.active}"`,
    });
  }

  return (
    <div
      className={`app ${isDragging ? "is-dragging" : ""}`}
      onKeyDown={handleKeyDown}
      {...dropHandlers}
    >
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={commands}
      />

      <Toast toast={toast} />
      <ShareDialog
        open={share.shareDialogOpen}
        onClose={share.closeShareDialog}
        onCreate={share.createShare}
        busy={share.shareBusy}
        error={share.shareError}
      />
      <PasswordPrompt
        open={!!share.pwPrompt}
        busy={share.pwPrompt?.busy}
        error={share.pwPrompt?.error}
        onSubmit={share.submitPassword}
        onCancel={share.cancelPassword}
      />
      <ImportConfigDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onApply={applyImportedConfig}
        activeProfile={profiles.active}
      />
      <ToolModalHost
        modal={toolModal}
        onClose={() => setToolModal(null)}
        onInsert={insertIntoInput}
      />
      <DropOverlay visible={isDragging} />
      <TopBar
        themeMode={themeMeta.mode}
        onOpenPalette={() => setPaletteOpen(true)}
        onToggleTheme={toggleTheme}
      />

      <Toolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        diffDisabled={!output && !error}
        lang={lang}
        onSelectLang={handleSelectLang}
        settings={settings}
        setSettings={setSettings}
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        onShare={share.openShareDialog}
        shareDisabled={!input.trim()}
        onFormat={handleFormat}
        onMinify={handleMinify}
        isFormatting={isFormatting}
        profiles={profiles}
        onImportConfig={() => setImportOpen(true)}
      />

      {curlSuggestion ? (
        <SuggestionBanner
          suggestion={curlSuggestion}
          actionLabel="Convert"
          onAccept={() => openCurl()}
          onDismiss={dismissCurlSuggestion}
        >
          Looks like a <b>cURL</b> command. Convert it to fetch, axios or Python requests?
        </SuggestionBanner>
      ) : (
        <SuggestionBanner
          suggestion={curlAvailable ? null : suggestion}
          onAccept={() => {
            handleSelectLang(suggestion.lang);
            setSuggestion(null);
          }}
          onDismiss={dismissSuggestion}
        />
      )}

      <div
        className="workspace"
        style={{
          "--sidebar-w": `${layout.sidebarW}px`,
        }}
      >
        <Sidebar
          lang={lang}
          onSelectLang={handleSelectLang}
          onOpenRoute={openLandingRoute}
          history={history}
          onRestoreHistory={restoreFromHistory}
          onClearHistory={clearHistory}
        />

        <Resizer
          ariaLabel="Resize sidebar"
          onDrag={(dx, startVal) => {
            const next = clampSidebarWidth(startVal + dx);
            setLayout((l) => (l.sidebarW === next ? l : { ...l, sidebarW: next }));
          }}
          startValue={layout.sidebarW}
        />

        <section
          ref={editorRef}
          className={`editor ${
            viewMode === "diff"
              ? "is-diff"
              : viewMode === "compare"
                ? "is-compare"
                : viewMode === "regex"
                  ? "is-regex"
                  : ""
          }`}
          style={{
            "--input-fr": `${layout.inputFr}fr`,
            "--output-fr": "1fr",
          }}
        >
          {viewMode === "diff" ? (
            <DiffPane
              language={currentLang}
              input={input}
              output={output}
              error={error}
            />
          ) : viewMode === "compare" ? (
            <ComparePanes
              language={currentLang}
              theme={settings.editorTheme}
              {...compare}
            />
          ) : viewMode === "regex" ? (
            <RegexPanes
              theme={settings.editorTheme}
              regex={regex}
              seedAvailable={!!input}
            />
          ) : (
            <>
              <InputPane
                language={currentLang}
                theme={settings.editorTheme}
                input={input}
                onInputChange={setInput}
                error={error}
                onPaste={() => {
                  if (settings.formatOnPaste) {
                    setTimeout(() => handleFormat({ silent: true }), 0);
                  }
                }}
                jsonPath={jsonPath}
                onJsonPathChange={setJsonPath}
                onFormat={() => handleFormat()}
                lint={lint}
                schema={
                  schemaActive
                    ? {
                        text: schemaState.text,
                        onChange: (text) => setSchemaState((s) => ({ ...s, text })),
                        validation: schemaValidation,
                        onGenerate: generateSchemaFromInput,
                      }
                    : null
                }
                onSchemaToggle={toggleSchema}
                onViewReady={(view) => {
                  inputViewRef.current = view;
                  inputEditorUsed.current = view.hasFocus;
                }}
                onEditorFocus={() => {
                  inputEditorUsed.current = true;
                }}
              />

              <Resizer
                ariaLabel="Resize input pane"
                onDrag={(dx, _startVal, ctx) => {
                  const editorEl = editorRef.current;
                  if (!editorEl) return;
                  const total = editorEl.getBoundingClientRect().width - RESIZER_PX;
                  const clamped = inputFrFromDrag(total, ctx.startInputPx, dx);
                  setLayout((l) =>
                    Math.abs(l.inputFr - clamped) < 0.001
                      ? l
                      : { ...l, inputFr: clamped }
                  );
                }}
                startContext={() => {
                  const editorEl = editorRef.current;
                  if (!editorEl) return { startInputPx: 0 };
                  const total = editorEl.getBoundingClientRect().width - RESIZER_PX;
                  return { startInputPx: inputPxFromFr(layout.inputFr, total) };
                }}
              />

              <OutputPane
                language={currentLang}
                theme={settings.editorTheme}
                output={output}
                error={error}
                outputView={outputView}
                jsonTreeData={jsonTreeData}
                jsonTableData={jsonTableData}
                onJsonViewChange={setJsonView}
                onUseJsonPath={filterByJsonPath}
                jsonTreeFilter={
                  outputFilter && outputFilter.output === output ? outputFilter : null
                }
                onNotify={setToast}
                treeSearchRequested={treeSearchRequested}
                onTreeSearchFocused={clearTreeSearchRequest}
                fullscreen={outputFullscreen}
                onToggleFullscreen={() => setOutputFullscreen((v) => !v)}
                conversions={conversionsFrom(lang)}
                onConvert={handleConvert}
                convertDisabled={!input.trim()}
                typegen={typegenView}
                typegenAvailable={lang === "json"}
                onTypegenToggle={() =>
                  typegenActive ? closeTypegen() : openTypegen()
                }
                onTypegenChange={(patch) => setTypegen((t) => ({ ...t, ...patch }))}
                curl={curlView}
                curlAvailable={curlAvailable}
                onCurlToggle={() => (curlActive ? closeCurl() : openCurl())}
                onCurlChange={(patch) => setCurlState((c) => ({ ...c, ...patch }))}
              />
            </>
          )}
        </section>
      </div>

      <StatusBar
        error={error}
        isFormatting={isFormatting}
        output={output}
        langLabel={currentLang.label}
        settings={settings}
      />
    </div>
  );
}
