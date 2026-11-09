import { useEffect, useMemo, useRef, useState } from "react";
import { formatCode } from "./formatters/index.js";
import { FORMAT_LABELS, conversionsFrom, convertData } from "./convert/index.js";
import CommandPalette from "./components/CommandPalette.jsx";
import ShareDialog, { PasswordPrompt } from "./components/ShareDialog.jsx";
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
import InputPane from "./components/InputPane.jsx";
import OutputPane from "./components/OutputPane.jsx";
import StatusBar from "./components/StatusBar.jsx";
import { buildCommands } from "./commands/index.js";
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
import { useSettings } from "./hooks/useSettings.js";
import { useHistory } from "./hooks/useHistory.js";
import { useLayout } from "./hooks/useLayout.js";
import { useWorkspace } from "./hooks/useWorkspace.js";
import { useCompareSnippets } from "./hooks/useCompareSnippets.js";
import { useToast } from "./hooks/useToast.js";
import { useShare } from "./hooks/useShare.js";
import { useLanguageSuggestion } from "./hooks/useLanguageSuggestion.js";
import { useFileDrop } from "./hooks/useFileDrop.js";
import { useWindowKeydown } from "./hooks/useWindowKeydown.js";
import { useRuffLint } from "./hooks/useRuffLint.js";

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [viewMode, setViewMode] = useState("split"); // "split" | "diff" | "compare"
  const compare = useCompareSnippets();
  const [toast, setToast] = useToast();
  const { history, pushHistory, clearHistory } = useHistory();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [layout, setLayout] = useLayout();
  const editorRef = useRef(null);
  const [jsonPath, setJsonPath] = useState("");
  const [jsonView, setJsonView] = useState("tree"); // 'tree' | 'code' | 'table'
  const [toolModal, setToolModal] = useState(null); // { id, result } | null
  const [outputFullscreen, setOutputFullscreen] = useState(false);

  const input = inputs[lang] ?? "";
  const currentLang = getLanguage(lang);
  // Ruff lint runs on its own debounce, never inside handleFormat.
  const lint = useRuffLint({
    enabled: settings.lint && lang === "python" && viewMode === "split",
    input,
    settings,
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

  function runTextUtil(label, fn) {
    if (!input) {
      setToast({ kind: "warn", message: "Input is empty" });
      return;
    }
    try {
      const result = fn(input);
      setOutput(result);
      setError(null);
      setToast({ kind: "ok", message: `${label} applied` });
    } catch (e) {
      setError({ message: e.message, line: null, column: null, hint: null });
      setOutput("");
    }
  }

  function openToolModal(tool) {
    if (!input) {
      setToast({ kind: "warn", message: tool.emptyMessage });
      return;
    }
    try {
      setToolModal({ id: tool.modal, result: tool.decode(input) });
      setError(null);
    } catch (e) {
      setError({ message: e.message, line: null, column: null, hint: null });
      setOutput("");
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
    const remember = (l, text) => {
      if (text && text.trim() && text.length <= MAX_HISTORY_ITEM) {
        pushHistory(createHistoryEntry({ lang: l, input: text, output: text }));
      }
    };
    const previousTarget = inputs[to];
    if (previousTarget !== SAMPLES[to] && previousTarget !== result) {
      remember(to, previousTarget);
    }
    remember(lang, input);
    setLang(to);
    setInputs((prev) => ({ ...prev, [to]: result }));
    setOutput(result);
    setError(null);
    setSuggestion(null);
    if (to !== "json") {
      setJsonPath("");
      setJsonView("code");
    }
    setToast({
      kind: "ok",
      message: `Converted ${FORMAT_LABELS[from]} → ${FORMAT_LABELS[to]} · previous input saved in Recent`,
    });
  }

  function restoreFromHistory(entry) {
    setLang(entry.lang);
    setInputs((prev) => ({ ...prev, [entry.lang]: entry.input }));
    setOutput("");
    setError(null);
    setSuggestion(null);
  }

  async function handleFormat({ silent = false } = {}) {
    if (isFormatting) return;
    if (!silent) setIsFormatting(true);
    try {
      const result = await formatCode(lang, input, {
        ...settings,
        jsonPath: lang === "json" ? jsonPath : null,
      });
      setOutput(result);
      setError(null);
      if (!silent && input.length <= MAX_HISTORY_ITEM) {
        pushHistory(createHistoryEntry({ lang, input, output: result }));
      }
    } catch (e) {
      if (silent) {
        // suppress error during auto-format typing — keep last good output
        return;
      }
      setError({
        message: e.message,
        line: e.line ?? null,
        column: e.column ?? null,
        hint: e.hint ?? null,
      });
      setOutput("");
    } finally {
      if (!silent) setIsFormatting(false);
    }
  }

  useEffect(() => {
    if (!settings.autoFormat) return;
    if (!input.trim()) return;
    const t = setTimeout(() => {
      handleFormat({ silent: true });
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, lang, settings.autoFormat, settings.indent, settings.lineWidth, settings.quotes]);

  function handleSelectLang(id) {
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
      copyOutput: () => output && navigator.clipboard.writeText(output),
      openSettings: () => setSettingsOpen(true),
      updateSettings: setSettings,
      selectLang: handleSelectLang,
      runTextUtil,
      openToolModal,
      convert: handleConvert,
    },
  });

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
      <ToolModalHost modal={toolModal} onClose={() => setToolModal(null)} />
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
        isFormatting={isFormatting}
      />

      <SuggestionBanner
        suggestion={suggestion}
        onAccept={() => {
          handleSelectLang(suggestion.lang);
          setSuggestion(null);
        }}
        onDismiss={dismissSuggestion}
      />

      <div
        className="workspace"
        style={{
          "--sidebar-w": `${layout.sidebarW}px`,
        }}
      >
        <Sidebar
          lang={lang}
          onSelectLang={handleSelectLang}
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
                onUseJsonPath={(p) => {
                  setJsonPath(p);
                  setToast({ kind: "ok", message: "Filter set — press ⌘⏎ to apply" });
                }}
                fullscreen={outputFullscreen}
                onToggleFullscreen={() => setOutputFullscreen((v) => !v)}
                conversions={conversionsFrom(lang)}
                onConvert={handleConvert}
                convertDisabled={!input.trim()}
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
