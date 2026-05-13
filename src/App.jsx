import { useEffect, useMemo, useRef, useState } from "react";
import { formatCode } from "./formatters/index.js";
import CodeEditor from "./components/CodeEditor.jsx";
import DiffView from "./components/DiffView.jsx";
import CommandPalette from "./components/CommandPalette.jsx";
import ShareDialog, { PasswordPrompt } from "./components/ShareDialog.jsx";
import JwtModal from "./components/JwtModal.jsx";
import Resizer from "./components/Resizer.jsx";
import CopyMarkdownButton from "./components/CopyMarkdownButton.jsx";
import { encryptShare, decryptShare } from "./share/crypto.js";
import { encodeShare, decodeShare } from "./share/url-share.js";
import { THEMES, getThemeMeta, flipTheme } from "./editor-themes.js";
import {
  LANGUAGES,
  SAMPLES,
  EXT_TO_LANG,
} from "./languages/registry.js";
import {
  detectLangFromContent,
  detectLangFromFilename,
} from "./languages/detect.js";
import {
  sortLines,
  dedupeLines,
  reverseLines,
  trimEachLine,
  collapseBlankLines,
  toUpperCase,
  toLowerCase,
  toTitleCase,
  base64Encode,
  base64Decode,
  urlEncode,
  urlDecode,
  hexEncode,
  hexDecode,
  decodeJwt,
  timestampToIso,
  isoToTimestamp,
  pythonToJson,
  jsonToPython,
} from "./text-utils/index.js";

// Language registry, file-extension map, content detection, and sample
// snippets live in src/languages/. Anything App-level imports from there.

const STORAGE_KEY = "pretty-lush:state:v1";
const LAYOUT_KEY = "pretty-lush:layout:v1";
const THEME_KEY = "pretty-lush:theme";
const SETTINGS_KEY = "pretty-lush:settings:v1";
const HISTORY_KEY = "pretty-lush:history:v1";
const MAX_INPUT_BYTES = 100_000;
const MAX_HISTORY_ITEM = 50_000;
const MAX_HISTORY = 20;

const _initialHistory = (() => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
})();

function formatRelativeTime(ts) {
  const sec = Math.max(0, (Date.now() - ts) / 1000);
  if (sec < 45) return "just now";
  if (sec < 90) return "a minute ago";
  const min = sec / 60;
  if (min < 45) return `${Math.round(min)} min ago`;
  if (min < 90) return "an hour ago";
  const hr = min / 60;
  if (hr < 24) return `${Math.round(hr)} h ago`;
  const day = hr / 24;
  if (day < 2) return "yesterday";
  return `${Math.round(day)} d ago`;
}

const DEFAULT_SETTINGS = {
  indent: 2,
  lineWidth: 80,
  quotes: "double",
  editorTheme: "pretty-lush-light",
  autoFormat: false,
  formatOnPaste: false,
};

const _initialSettings = (() => {
  function migratedDefault() {
    try {
      const oldTheme = localStorage.getItem(THEME_KEY);
      if (oldTheme === "dark")
        return { ...DEFAULT_SETTINGS, editorTheme: "pretty-lush-dark" };
      if (oldTheme === "light") return DEFAULT_SETTINGS;
    } catch {}
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches
    )
      return { ...DEFAULT_SETTINGS, editorTheme: "pretty-lush-dark" };
    return DEFAULT_SETTINGS;
  }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return migratedDefault();
    const parsed = JSON.parse(raw);
    return { ...migratedDefault(), ...parsed };
  } catch {
    return migratedDefault();
  }
})();

const _initialState = (() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    return data;
  } catch {
    return null;
  }
})();

const DEFAULT_LAYOUT = { sidebarW: 220, inputFr: 1 };
const SIDEBAR_MIN = 160;
const SIDEBAR_MAX = 480;
const INPUT_FR_MIN = 0.2;
const INPUT_FR_MAX = 5;

const _initialLayout = (() => {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw);
    const sidebarW = Number(parsed?.sidebarW);
    const inputFr = Number(parsed?.inputFr);
    return {
      sidebarW:
        Number.isFinite(sidebarW)
          ? Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, sidebarW))
          : DEFAULT_LAYOUT.sidebarW,
      inputFr:
        Number.isFinite(inputFr) && inputFr > 0
          ? Math.min(INPUT_FR_MAX, Math.max(INPUT_FR_MIN, inputFr))
          : DEFAULT_LAYOUT.inputFr,
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
})();

const _initialLang =
  _initialState?.lang && LANGUAGES.some((l) => l.id === _initialState.lang)
    ? _initialState.lang
    : "python";

const _initialInputs = {
  ...SAMPLES,
  ...(_initialState?.inputs && typeof _initialState.inputs === "object"
    ? _initialState.inputs
    : {}),
};

export default function App() {
  const [lang, setLang] = useState(_initialLang);
  const [inputs, setInputs] = useState(_initialInputs);
  const [output, setOutput] = useState("");
  const [error, setError] = useState(null);
  const [isFormatting, setIsFormatting] = useState(false);
  const [settings, setSettings] = useState(_initialSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const themeMeta = getThemeMeta(settings.editorTheme);

  const [viewMode, setViewMode] = useState("split"); // "split" | "diff" | "compare"
  const [compareA, setCompareA] = useState(() => {
    try {
      const raw = localStorage.getItem("pretty-lush:compare:v1");
      if (!raw) return "";
      return JSON.parse(raw)?.a || "";
    } catch {
      return "";
    }
  });
  const [compareB, setCompareB] = useState(() => {
    try {
      const raw = localStorage.getItem("pretty-lush:compare:v1");
      if (!raw) return "";
      return JSON.parse(raw)?.b || "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          "pretty-lush:compare:v1",
          JSON.stringify({ a: compareA, b: compareB })
        );
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [compareA, compareB]);
  const [isDragging, setIsDragging] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [dismissedSuggestion, setDismissedSuggestion] = useState("");
  const [shareToast, setShareToast] = useState(null);
  const [history, setHistory] = useState(_initialHistory);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState(null);
  const [pwPrompt, setPwPrompt] = useState(null);
  const outputCaptureRef = useRef(null);
  const [layout, setLayout] = useState(_initialLayout);
  const workspaceRef = useRef(null);
  const editorRef = useRef(null);
  const [jsonPath, setJsonPath] = useState("");
  const [jsonView, setJsonView] = useState("code"); // 'code' | 'table'
  const [jwtResult, setJwtResult] = useState(null);
  const [outputFullscreen, setOutputFullscreen] = useState(false);

  useEffect(() => {
    if (!outputFullscreen) return;
    function onKey(e) {
      if (e.key === "Escape") setOutputFullscreen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [outputFullscreen]);

  function runTextUtil(label, fn) {
    if (!input) {
      setShareToast({ kind: "warn", message: "Input is empty" });
      return;
    }
    try {
      const result = fn(input);
      setOutput(result);
      setError(null);
      setShareToast({ kind: "ok", message: `${label} applied` });
    } catch (e) {
      setError({ message: e.message, line: null, column: null, hint: null });
      setOutput("");
    }
  }

  function runJwtDecode() {
    if (!input) {
      setShareToast({ kind: "warn", message: "Paste a JWT first" });
      return;
    }
    try {
      const r = decodeJwt(input);
      setJwtResult(r);
      setError(null);
    } catch (e) {
      setError({ message: e.message, line: null, column: null, hint: null });
      setOutput("");
    }
  }

  const jsonTableData = useMemo(() => {
    if (lang !== "json" || !output) return null;
    try {
      const parsed = JSON.parse(output);
      if (!Array.isArray(parsed) || parsed.length === 0) return null;
      if (!parsed.every((row) => row && typeof row === "object" && !Array.isArray(row)))
        return null;
      const keys = [];
      const seen = new Set();
      for (const row of parsed) {
        for (const k of Object.keys(row)) {
          if (!seen.has(k)) {
            seen.add(k);
            keys.push(k);
          }
        }
      }
      return { rows: parsed, keys };
    } catch {
      return null;
    }
  }, [lang, output]);

  useEffect(() => {
    if (!jsonTableData && jsonView === "table") setJsonView("code");
  }, [jsonTableData, jsonView]);

  useEffect(() => {
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
    } catch {}
  }, [layout]);

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {}
  }, [history]);

  // restore from URL share hash on mount (one-shot)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#s=")) {
      const decoded = decodeShare(hash.slice(3));
      if (!decoded) return;
      if (decoded.lang && LANGUAGES.some((l) => l.id === decoded.lang)) {
        setLang(decoded.lang);
      }
      if (typeof decoded.input === "string") {
        setInputs((prev) => ({ ...prev, [decoded.lang || lang]: decoded.input }));
      }
      setOutput("");
      setError(null);
      window.history.replaceState(null, "", window.location.pathname);
    } else if (hash.startsWith("#p=")) {
      const rest = hash.slice(3);
      const dot = rest.indexOf(".");
      if (dot < 4) return;
      const id = rest.slice(0, dot);
      const urlKey = rest.slice(dot + 1);
      if (!/^[A-Za-z0-9]{4,16}$/.test(id) || !urlKey) return;
      window.history.replaceState(null, "", window.location.pathname);
      loadServerPaste(id, urlKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadServerPaste(id, urlKey, password = null) {
    try {
      const res = await fetch(`/api/paste/${encodeURIComponent(id)}`);
      if (!res.ok) {
        const msg =
          res.status === 404
            ? "This share link has expired or does not exist."
            : `Could not load shared snippet (HTTP ${res.status}).`;
        setShareToast({ kind: "err", message: msg });
        return;
      }
      const record = await res.json();

      if (record.hasPassword && !password) {
        setPwPrompt({ id, urlKey, record, busy: false, error: null });
        return;
      }

      try {
        const plaintext = await decryptShare({
          ciphertext: record.ciphertext,
          iv: record.iv,
          salt: record.salt,
          hasPassword: record.hasPassword,
          urlKey,
          password,
        });
        const targetLang =
          record.lang && LANGUAGES.some((l) => l.id === record.lang)
            ? record.lang
            : lang;
        setLang(targetLang);
        setInputs((prev) => ({ ...prev, [targetLang]: plaintext }));
        setOutput("");
        setError(null);
        setPwPrompt(null);
        setShareToast({ kind: "ok", message: "Shared snippet loaded" });
      } catch (e) {
        if (record.hasPassword) {
          setPwPrompt((p) => ({
            ...(p || { id, urlKey, record }),
            busy: false,
            error: e.message || "Wrong password",
          }));
        } else {
          setShareToast({ kind: "err", message: e.message || "Decryption failed" });
        }
      }
    } catch (e) {
      setShareToast({ kind: "err", message: "Network error loading snippet" });
    }
  }

  function openShareDialog() {
    if (!input.trim()) return;
    setShareError(null);
    setShareDialogOpen(true);
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  async function handleCreateShare({ mode, password, ttl, burnAfterRead }) {
    setShareBusy(true);
    setShareError(null);
    try {
      if (mode === "url") {
        const payload = encodeShare({ lang, input });
        const url = `${window.location.origin}${window.location.pathname}#s=${payload}`;
        const sizeKB = (url.length / 1024).toFixed(1);
        const ok = await copyToClipboard(url);
        setShareDialogOpen(false);
        if (!ok) {
          setShareToast({ kind: "err", message: "Could not copy link" });
        } else if (url.length > 8192) {
          setShareToast({
            kind: "warn",
            message: `Link copied (${sizeKB} KB — some chat apps may reject it)`,
          });
        } else {
          setShareToast({ kind: "ok", message: "Share link copied" });
        }
      } else {
        const enc = await encryptShare(input, password);
        const res = await fetch("/api/paste", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ciphertext: enc.ciphertext,
            iv: enc.iv,
            salt: enc.salt,
            hasPassword: enc.hasPassword,
            lang,
            ttl,
            burnAfterRead: !!burnAfterRead,
          }),
        });
        if (!res.ok) {
          let msg = `Server rejected the snippet (HTTP ${res.status})`;
          let code = null;
          try {
            const body = await res.json();
            if (body?.error) msg = body.error;
            if (body?.code) code = body.code;
          } catch {}
          setShareError({
            message: msg,
            code,
            suggestUrl: res.status === 503 || code === "STORE_UNAVAILABLE",
          });
          return;
        }
        const { id } = await res.json();
        const url = `${window.location.origin}${window.location.pathname}#p=${id}.${enc.urlKey}`;
        const ok = await copyToClipboard(url);
        setShareDialogOpen(false);
        setShareToast({
          kind: ok ? "ok" : "warn",
          message: ok
            ? password
              ? "Encrypted link copied. Share the password separately."
              : "Encrypted link copied"
            : "Link created but clipboard write failed",
        });
      }
    } catch (e) {
      setShareError(e?.message || "Something went wrong");
    } finally {
      setShareBusy(false);
    }
  }

  async function handlePwSubmit(password) {
    if (!pwPrompt) return;
    setPwPrompt((p) => ({ ...p, busy: true, error: null }));
    await loadServerPaste(pwPrompt.id, pwPrompt.urlKey, password);
  }

  useEffect(() => {
    if (!shareToast) return;
    const t = setTimeout(() => setShareToast(null), 2200);
    return () => clearTimeout(t);
  }, [shareToast]);

  const input = inputs[lang] ?? "";

  function setInput(text) {
    setInputs((prev) => ({ ...prev, [lang]: text }));
  }

  useEffect(() => {
    const t = setTimeout(() => {
      const detected = detectLangFromContent(input);
      const key = `${lang}:${detected}:${input.slice(0, 200)}`;
      if (detected && detected !== lang && dismissedSuggestion !== key) {
        setSuggestion({ lang: detected, key });
      } else {
        setSuggestion(null);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [input, lang, dismissedSuggestion]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeMeta.mode);
    try {
      localStorage.setItem(THEME_KEY, themeMeta.mode);
    } catch {}
  }, [themeMeta.mode]);

  useEffect(() => {
    const root = document.documentElement;
    const overrideKeys = [
      "--bg",
      "--surface",
      "--surface-2",
      "--line",
      "--line-strong",
      "--ink",
      "--ink-2",
      "--muted",
      "--accent",
      "--accent-soft",
      "--primary-bg",
      "--primary-bg-hover",
      "--primary-fg",
    ];
    if (themeMeta.builtin) {
      overrideKeys.forEach((k) => root.style.removeProperty(k));
      return;
    }
    root.style.setProperty("--bg", themeMeta.chrome);
    root.style.setProperty("--surface", themeMeta.bg);
    root.style.setProperty("--surface-2", themeMeta.chrome);
    root.style.setProperty("--line", themeMeta.line);
    root.style.setProperty("--line-strong", themeMeta.line);
    root.style.setProperty("--ink", themeMeta.fg);
    root.style.setProperty("--ink-2", themeMeta.fg);
    root.style.setProperty("--muted", themeMeta.muted);
    root.style.setProperty("--accent", themeMeta.accent);
    root.style.setProperty("--accent-soft", themeMeta.accentSoft);
    root.style.setProperty("--primary-bg", themeMeta.accent);
    root.style.setProperty("--primary-bg-hover", themeMeta.accent);
    root.style.setProperty("--primary-fg", themeMeta.bg);
  }, [themeMeta]);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const trimmedInputs = {};
        for (const k of Object.keys(inputs)) {
          const v = inputs[k] || "";
          if (v.length <= MAX_INPUT_BYTES) trimmedInputs[k] = v;
        }
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ lang, inputs: trimmedInputs })
        );
      } catch {
        // ignore quota errors
      }
    }, 500);
    return () => clearTimeout(t);
  }, [lang, inputs]);

  const currentLang = LANGUAGES.find((l) => l.id === lang);

  const stats = useMemo(() => {
    const inLines = input.split("\n").length;
    const outLines = output ? output.split("\n").length : 0;
    return { inLines, outLines };
  }, [input, output]);

  function pushHistory(entry) {
    setHistory((prev) => {
      const filtered = prev.filter(
        (e) => !(e.lang === entry.lang && e.input === entry.input)
      );
      const next = [entry, ...filtered].slice(0, MAX_HISTORY);
      return next;
    });
  }

  function restoreFromHistory(entry) {
    setLang(entry.lang);
    setInputs((prev) => ({ ...prev, [entry.lang]: entry.input }));
    setOutput("");
    setError(null);
    setSuggestion(null);
  }

  function clearHistory() {
    setHistory([]);
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
        pushHistory({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          ts: Date.now(),
          lang,
          input,
          snippet: input.replace(/\s+/g, " ").slice(0, 80).trim(),
          inSize: input.length,
          outSize: result.length,
        });
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

  function handleDragOver(e) {
    if (e.dataTransfer?.types?.includes("Files")) {
      e.preventDefault();
      setIsDragging(true);
    }
  }

  function handleDragLeave(e) {
    if (e.target === e.currentTarget) setIsDragging(false);
  }

  async function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
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

  return (
    <div
      className={`app ${isDragging ? "is-dragging" : ""}`}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={[
          {
            id: "format",
            label: "Format",
            shortcut: "⌘⏎",
            run: () => handleFormat(),
          },
          {
            id: "share",
            label: "Share snippet…",
            keywords: "link copy encrypted password",
            run: openShareDialog,
          },
          {
            id: "clear",
            label: "Clear input",
            run: () => {
              setInput("");
              setOutput("");
              setError(null);
            },
          },
          {
            id: "diff",
            label: viewMode === "diff" ? "Switch to split view" : "Switch to diff view",
            run: () => setViewMode(viewMode === "diff" ? "split" : "diff"),
          },
          {
            id: "compare",
            label: "Compare two snippets (A vs B)",
            keywords: "diff",
            run: () => setViewMode("compare"),
          },
          {
            id: "fullscreen",
            label: outputFullscreen
              ? "Exit fullscreen output"
              : "Fullscreen output",
            keywords: "zen focus expand",
            run: () => setOutputFullscreen((v) => !v),
          },
          {
            id: "copy-output",
            label: "Copy output",
            keywords: "clipboard",
            run: () => output && navigator.clipboard.writeText(output),
          },
          {
            id: "settings",
            label: "Open format options",
            run: () => setSettingsOpen(true),
          },
          {
            id: "theme-flip",
            label: themeMeta.mode === "dark" ? "Switch to light theme" : "Switch to dark theme",
            run: () =>
              setSettings((s) => ({ ...s, editorTheme: flipTheme(s.editorTheme) })),
          },
          ...LANGUAGES.map((l) => ({
            id: `lang-${l.id}`,
            label: l.label,
            group: "Language",
            keywords: l.ext,
            run: () => handleSelectLang(l.id),
          })),
          ...THEMES.map((t) => ({
            id: `theme-${t.id}`,
            label: t.label,
            group: "Theme",
            run: () => setSettings((s) => ({ ...s, editorTheme: t.id })),
          })),
          // ── text utilities (apply to input → output) ─────
          { id: "util-sort-asc", group: "Text", label: "Sort lines (A→Z)", keywords: "alphabetize", run: () => runTextUtil("Sort A→Z", (s) => sortLines(s, { reverse: false })) },
          { id: "util-sort-desc", group: "Text", label: "Sort lines (Z→A)", keywords: "alphabetize reverse", run: () => runTextUtil("Sort Z→A", (s) => sortLines(s, { reverse: true })) },
          { id: "util-dedupe", group: "Text", label: "Dedupe lines", keywords: "unique distinct", run: () => runTextUtil("Dedupe", dedupeLines) },
          { id: "util-reverse", group: "Text", label: "Reverse line order", keywords: "flip", run: () => runTextUtil("Reverse", reverseLines) },
          { id: "util-trim", group: "Text", label: "Trim trailing whitespace", keywords: "rtrim cleanup", run: () => runTextUtil("Trim", trimEachLine) },
          { id: "util-collapse", group: "Text", label: "Collapse blank lines", keywords: "squeeze empty", run: () => runTextUtil("Collapse blanks", collapseBlankLines) },
          { id: "util-upper", group: "Text", label: "UPPERCASE", keywords: "case", run: () => runTextUtil("Uppercase", toUpperCase) },
          { id: "util-lower", group: "Text", label: "lowercase", keywords: "case", run: () => runTextUtil("Lowercase", toLowerCase) },
          { id: "util-title", group: "Text", label: "Title Case", keywords: "case", run: () => runTextUtil("Title case", toTitleCase) },
          // ── encoding ────────────────────────────────────
          { id: "util-b64-enc", group: "Encode", label: "Base64 encode", keywords: "encode", run: () => runTextUtil("Base64 encode", base64Encode) },
          { id: "util-b64-dec", group: "Encode", label: "Base64 decode", keywords: "decode", run: () => runTextUtil("Base64 decode", base64Decode) },
          { id: "util-url-enc", group: "Encode", label: "URL encode (percent)", keywords: "uri escape", run: () => runTextUtil("URL encode", urlEncode) },
          { id: "util-url-dec", group: "Encode", label: "URL decode (percent)", keywords: "uri unescape", run: () => runTextUtil("URL decode", urlDecode) },
          { id: "util-hex-enc", group: "Encode", label: "String → hex", keywords: "encode", run: () => runTextUtil("Hex encode", hexEncode) },
          { id: "util-hex-dec", group: "Encode", label: "Hex → string", keywords: "decode", run: () => runTextUtil("Hex decode", hexDecode) },
          // ── conversion ──────────────────────────────────
          { id: "util-py-to-json", group: "Convert", label: "Python dict → JSON", keywords: "repr literal true false none", run: () => runTextUtil("Python → JSON", (s) => pythonToJson(s, { indent: Number(settings.indent) === 0 || settings.indent === "tab" ? 2 : Number(settings.indent) || 2 })) },
          { id: "util-json-to-py", group: "Convert", label: "JSON → Python dict", keywords: "literal true false none", run: () => runTextUtil("JSON → Python", (s) => jsonToPython(s, { indent: settings.indent === "tab" ? 4 : Number(settings.indent) || 4 })) },
          // ── special ─────────────────────────────────────
          { id: "util-jwt", group: "Decode", label: "Decode JWT", keywords: "token jsonwebtoken", run: runJwtDecode },
          { id: "util-ts-iso", group: "Decode", label: "Unix timestamp → ISO date", keywords: "epoch time", run: () => runTextUtil("Timestamp → ISO", timestampToIso) },
          { id: "util-iso-ts", group: "Decode", label: "ISO date → Unix timestamp", keywords: "epoch time", run: () => runTextUtil("ISO → timestamp", isoToTimestamp) },
        ]}
      />

      {shareToast && (
        <div className={`toast toast-${shareToast.kind}`} role="status">
          {shareToast.message}
        </div>
      )}
      <ShareDialog
        open={shareDialogOpen}
        onClose={() => {
          if (!shareBusy) {
            setShareDialogOpen(false);
            setShareError(null);
          }
        }}
        onCreate={handleCreateShare}
        busy={shareBusy}
        error={shareError}
      />
      <PasswordPrompt
        open={!!pwPrompt}
        busy={pwPrompt?.busy}
        error={pwPrompt?.error}
        onSubmit={handlePwSubmit}
        onCancel={() => setPwPrompt(null)}
      />
      <JwtModal result={jwtResult} onClose={() => setJwtResult(null)} />
      {isDragging && (
        <div className="drop-overlay">
          <div className="drop-overlay-card">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>Drop file to format</span>
          </div>
        </div>
      )}
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">pl</span>
          <span className="brand-name">
            pretty-lush <span className="dim">/ code formatter</span>
          </span>
          <span
            className="privacy-pill"
            title="All formatting runs locally in your browser. Nothing is uploaded."
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>runs in your browser</span>
          </span>
          <a
            className="oss-chip"
            href="https://github.com/selamet/pretty-lush"
            target="_blank"
            rel="noopener noreferrer"
            title="Source on GitHub — give it a ★"
          >
            <svg
              className="oss-chip-mark"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.49 0-.24-.01-.87-.01-1.71-2.79.62-3.38-1.37-3.38-1.37-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.9 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.23-.26-4.57-1.14-4.57-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.05A9.4 9.4 0 0 1 12 7.07c.85.004 1.71.12 2.51.34 1.91-1.33 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.58 5.06.36.32.68.94.68 1.89 0 1.37-.01 2.47-.01 2.81 0 .27.18.6.69.49C19.13 20.6 22 16.77 22 12.25 22 6.58 17.52 2 12 2z" />
            </svg>
            <span className="oss-chip-repo">selamet/pretty-lush</span>
            <span className="oss-chip-sep" aria-hidden="true" />
            <span className="oss-chip-star" aria-hidden="true">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span className="oss-chip-star-label">Star</span>
            </span>
          </a>
        </div>
        <div className="top-actions">
          <div className="view-toggle" role="tablist" aria-label="View mode">
            <button
              type="button"
              className={viewMode === "split" ? "on" : ""}
              onClick={() => setViewMode("split")}
              title="Side-by-side view"
            >
              Split
            </button>
            <button
              type="button"
              className={viewMode === "diff" ? "on" : ""}
              onClick={() => setViewMode("diff")}
              title="Diff view"
              disabled={!output && !error}
            >
              Diff
            </button>
            <button
              type="button"
              className={viewMode === "compare" ? "on" : ""}
              onClick={() => setViewMode("compare")}
              title="Compare two snippets"
            >
              Compare
            </button>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={openShareDialog}
            aria-label="Share snippet"
            title="Share snippet"
            disabled={!input.trim()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </button>
          <div className="settings-wrap">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setSettingsOpen((v) => !v)}
              aria-label="Format options"
              title="Format options"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.07-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
            {settingsOpen && (
              <SettingsPopover
                settings={settings}
                onChange={setSettings}
                onClose={() => setSettingsOpen(false)}
              />
            )}
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={() =>
              setSettings((s) => ({
                ...s,
                editorTheme: flipTheme(s.editorTheme),
              }))
            }
            aria-label={
              themeMeta.mode === "dark"
                ? "Switch to light theme"
                : "Switch to dark theme"
            }
            title={themeMeta.mode === "dark" ? "Light theme" : "Dark theme"}
          >
            {themeMeta.mode === "dark" ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          <select
            className="lang-select"
            value={lang}
            onChange={(e) => handleSelectLang(e.target.value)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          <button
            className="btn-primary btn"
            onClick={handleFormat}
            disabled={isFormatting}
          >
            {isFormatting ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Formatting…
              </>
            ) : (
              <>
                Format <span className="kbd">⌘⏎</span>
              </>
            )}
          </button>
        </div>
      </header>

      {suggestion && (
        <div className="suggestion">
          <span>
            Looks like{" "}
            <b>
              {LANGUAGES.find((l) => l.id === suggestion.lang)?.label ||
                suggestion.lang}
            </b>
            . Switch?
          </span>
          <button
            type="button"
            className="suggestion-btn"
            onClick={() => {
              handleSelectLang(suggestion.lang);
              setSuggestion(null);
            }}
          >
            Switch
          </button>
          <button
            type="button"
            className="suggestion-dismiss"
            aria-label="Dismiss"
            onClick={() => {
              setDismissedSuggestion(suggestion.key);
              setSuggestion(null);
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      <div
        className="workspace"
        ref={workspaceRef}
        style={{
          "--sidebar-w": `${layout.sidebarW}px`,
        }}
      >
        <aside className="sidebar">
          <div className="side-label">Languages</div>
          {LANGUAGES.map((l) => (
            <div
              key={l.id}
              className={`file-row ${l.id === lang ? "active" : ""}`}
              onClick={() => handleSelectLang(l.id)}
            >
              {l.label}
              {l.ext && <span className="file-ext">.{l.ext}</span>}
            </div>
          ))}

          {history.length > 0 && (
            <>
              <div className="side-label side-label-with-action">
                <span>Recent</span>
                <button
                  type="button"
                  className="side-action"
                  onClick={clearHistory}
                  title="Clear history"
                >
                  Clear
                </button>
              </div>
              {history.slice(0, 8).map((h) => (
                <div
                  key={h.id}
                  className="history-row"
                  onClick={() => restoreFromHistory(h)}
                  title={h.snippet}
                >
                  <span className="history-lang">
                    {LANGUAGES.find((l) => l.id === h.lang)?.ext || h.lang}
                  </span>
                  <span className="history-snippet">{h.snippet || "(empty)"}</span>
                  <span className="history-time">{formatRelativeTime(h.ts)}</span>
                </div>
              ))}
            </>
          )}
        </aside>

        <Resizer
          ariaLabel="Resize sidebar"
          onDrag={(dx, startVal) => {
            const next = Math.min(
              SIDEBAR_MAX,
              Math.max(SIDEBAR_MIN, startVal + dx)
            );
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
            <div className="pane diff-pane">
              <div className="pane-head">
                <span className="title">Diff — input ↔ output</span>
                <div className="pane-actions">
                  <DownloadButton
                    text={output}
                    filename={`formatted${currentLang.ext ? `.${currentLang.ext}` : ""}`}
                  />
                  <CopyButton text={output} />
                </div>
              </div>
              <div className="editor-host">
                {error ? (
                  <ErrorCard error={error} language={currentLang.label} />
                ) : (
                  <DiffView before={input} after={output} />
                )}
              </div>
            </div>
          ) : viewMode === "compare" ? (
            <>
              <div className="pane compare-a">
                <div className="pane-head">
                  <span className="title">A</span>
                  <div className="pane-actions">
                    <span className="meta">
                      {compareA ? compareA.split("\n").length : 0} lines
                    </span>
                    <button
                      type="button"
                      className="copy-btn"
                      onClick={() => setCompareA("")}
                      disabled={!compareA}
                      title="Clear A"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="editor-host">
                  <CodeEditor
                    theme={settings.editorTheme}
                    value={compareA}
                    onChange={setCompareA}
                    language={lang}
                    placeholder={`Paste version A (${currentLang.label})…`}
                  />
                </div>
              </div>
              <div className="pane compare-b">
                <div className="pane-head">
                  <span className="title">B</span>
                  <div className="pane-actions">
                    <span className="meta">
                      {compareB ? compareB.split("\n").length : 0} lines
                    </span>
                    <button
                      type="button"
                      className="copy-btn"
                      onClick={() => setCompareB("")}
                      disabled={!compareB}
                      title="Clear B"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      className="copy-btn"
                      onClick={() => {
                        const a = compareA;
                        setCompareA(compareB);
                        setCompareB(a);
                      }}
                      disabled={!compareA && !compareB}
                      title="Swap A and B"
                    >
                      Swap
                    </button>
                  </div>
                </div>
                <div className="editor-host">
                  <CodeEditor
                    theme={settings.editorTheme}
                    value={compareB}
                    onChange={setCompareB}
                    language={lang}
                    placeholder={`Paste version B (${currentLang.label})…`}
                  />
                </div>
              </div>
              <div className="pane compare-diff">
                <div className="pane-head">
                  <span className="title">Diff — A ↔ B</span>
                  <span className="meta">
                    {compareA === compareB
                      ? compareA
                        ? "identical"
                        : "—"
                      : "differs"}
                  </span>
                </div>
                <div className="editor-host">
                  {!compareA && !compareB ? (
                    <div className="compare-empty">
                      Paste two snippets above to see the diff.
                    </div>
                  ) : (
                    <DiffView before={compareA} after={compareB} />
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
          <div className="pane">
            <div className="pane-head">
              <span className="title">Input</span>
              <span className="meta">
                {stats.inLines} {stats.inLines === 1 ? "line" : "lines"}
              </span>
            </div>
            {lang === "json" && (
              <div className="json-bar">
                <label className="json-bar-label" htmlFor="jsonpath-input">
                  JSONPath
                </label>
                <input
                  id="jsonpath-input"
                  type="text"
                  className="json-bar-input"
                  spellCheck={false}
                  autoComplete="off"
                  value={jsonPath}
                  onChange={(e) => setJsonPath(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleFormat();
                    }
                  }}
                  placeholder="$.foo.bar  ·  $..name  ·  $.items[*].id"
                />
                {jsonPath && (
                  <button
                    type="button"
                    className="json-bar-clear"
                    onClick={() => setJsonPath("")}
                    title="Clear path"
                    aria-label="Clear JSONPath"
                  >
                    ×
                  </button>
                )}
              </div>
            )}
            <div
              className="editor-host"
              onPaste={() => {
                if (settings.formatOnPaste) {
                  setTimeout(() => handleFormat({ silent: true }), 0);
                }
              }}
            >
              <CodeEditor theme={settings.editorTheme}
                value={input}
                onChange={setInput}
                language={lang}
                placeholder={`Paste ${currentLang.label} here…`}
                errorLine={error?.line ?? null}
              />
            </div>
          </div>

          <Resizer
            ariaLabel="Resize input pane"
            onDrag={(dx, _startVal, ctx) => {
              const editorEl = editorRef.current;
              if (!editorEl) return;
              const total = editorEl.getBoundingClientRect().width - 5; // minus handle
              const startInputPx = ctx.startInputPx;
              const nextInputPx = Math.min(
                total - 80,
                Math.max(80, startInputPx + dx)
              );
              const fr = nextInputPx / Math.max(1, total - nextInputPx);
              const clamped = Math.min(
                INPUT_FR_MAX,
                Math.max(INPUT_FR_MIN, fr)
              );
              setLayout((l) =>
                Math.abs(l.inputFr - clamped) < 0.001
                  ? l
                  : { ...l, inputFr: clamped }
              );
            }}
            startContext={() => {
              const editorEl = editorRef.current;
              if (!editorEl) return { startInputPx: 0 };
              const total = editorEl.getBoundingClientRect().width - 5;
              return {
                startInputPx: (layout.inputFr / (layout.inputFr + 1)) * total,
              };
            }}
          />

          <div className={`pane ${outputFullscreen ? "is-fullscreen" : ""}`}>
            <div className="pane-head">
              <span className="title">Output</span>
              <div className="pane-actions">
                <span className="meta">
                  {output ? `${stats.outLines} lines` : "—"}
                </span>
                {jsonTableData && (
                  <div className="view-toggle small" role="tablist" aria-label="Output view">
                    <button
                      type="button"
                      className={jsonView === "code" ? "on" : ""}
                      onClick={() => setJsonView("code")}
                    >
                      Code
                    </button>
                    <button
                      type="button"
                      className={jsonView === "table" ? "on" : ""}
                      onClick={() => setJsonView("table")}
                    >
                      Table
                    </button>
                  </div>
                )}
                <ImageButton
                  targetRef={outputCaptureRef}
                  language={currentLang.label}
                  disabled={!output || !!error}
                />
                <DownloadButton
                  text={output}
                  filename={`formatted${currentLang.ext ? `.${currentLang.ext}` : ""}`}
                />
                <CopyMarkdownButton text={output} lang={lang} />
                <CopyButton text={output} />
                <FullscreenButton
                  active={outputFullscreen}
                  onToggle={() => setOutputFullscreen((v) => !v)}
                />
              </div>
            </div>
            <div className="editor-host" ref={outputCaptureRef}>
              {error ? (
                <ErrorCard error={error} language={currentLang.label} />
              ) : jsonTableData && jsonView === "table" ? (
                <JsonTable rows={jsonTableData.rows} keys={jsonTableData.keys} />
              ) : (
                <CodeEditor theme={settings.editorTheme}
                  value={output}
                  language={lang}
                  readOnly
                  placeholder="Press Format (⌘⏎) to format the input."
                />
              )}
            </div>
          </div>
            </>
          )}
        </section>
      </div>

      <footer className="status">
        <span className={error ? "err" : isFormatting ? "" : "ok"}>●</span>
        <span>
          {isFormatting
            ? "formatting…"
            : error
              ? error.line
                ? `error · line ${error.line}`
                : "error"
              : output
                ? "formatted"
                : "idle"}
        </span>
        <span>{currentLang.label}</span>
        <span className="spacer" />
        <span>utf-8 · lf</span>
      </footer>
    </div>
  );
}

function SettingsPopover({ settings, onChange, onClose }) {
  useEffect(() => {
    function onDocClick(e) {
      if (!e.target.closest(".settings-wrap")) onClose();
    }
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  function set(key, value) {
    onChange({ ...settings, [key]: value });
  }

  return (
    <div className="popover" role="dialog" aria-label="Format options">
      <div className="popover-row">
        <label>Editor theme</label>
        <select
          className="popover-select"
          value={settings.editorTheme}
          onChange={(e) => set("editorTheme", e.target.value)}
        >
          {THEMES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="popover-row">
        <label>Indent</label>
        <div className="seg">
          {[2, 4, "tab"].map((v) => (
            <button
              key={String(v)}
              type="button"
              className={settings.indent === v ? "on" : ""}
              onClick={() => set("indent", v)}
            >
              {v === "tab" ? "tab" : `${v} sp`}
            </button>
          ))}
        </div>
      </div>

      <div className="popover-row">
        <label>
          Line width <span className="val">{settings.lineWidth}</span>
        </label>
        <input
          type="range"
          min="60"
          max="120"
          step="2"
          value={settings.lineWidth}
          onChange={(e) => set("lineWidth", Number(e.target.value))}
        />
      </div>

      <div className="popover-row">
        <label>Quotes</label>
        <div className="seg">
          {["single", "double", "preserve"].map((q) => (
            <button
              key={q}
              type="button"
              className={settings.quotes === q ? "on" : ""}
              onClick={() => set("quotes", q)}
            >
              {q === "single" ? "'" : q === "double" ? '"' : "auto"}
            </button>
          ))}
        </div>
      </div>

      <div className="popover-row toggle">
        <label>
          Auto format
          <span className="hint">on every change, after 800ms</span>
        </label>
        <button
          type="button"
          className={`switch ${settings.autoFormat ? "on" : ""}`}
          onClick={() => set("autoFormat", !settings.autoFormat)}
          aria-pressed={settings.autoFormat}
        >
          <span className="knob" />
        </button>
      </div>

      <div className="popover-row toggle">
        <label>
          Format on paste
          <span className="hint">format immediately after pasting</span>
        </label>
        <button
          type="button"
          className={`switch ${settings.formatOnPaste ? "on" : ""}`}
          onClick={() => set("formatOnPaste", !settings.formatOnPaste)}
          aria-pressed={settings.formatOnPaste}
        >
          <span className="knob" />
        </button>
      </div>

      <div className="popover-foot">Applies on next Format (⌘⏎).</div>
    </div>
  );
}

function DownloadButton({ text, filename }) {
  function handleDownload() {
    if (!text) return;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "formatted.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      className="copy-btn"
      onClick={handleDownload}
      disabled={!text}
      aria-label="Download output"
      title={`Download as ${filename || "file"}`}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Download
    </button>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  async function handleCopy() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      className="copy-btn"
      onClick={handleCopy}
      disabled={!text}
      aria-label="Copy output"
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy
        </>
      )}
    </button>
  );
}

function JsonTable({ rows, keys }) {
  function renderCell(v) {
    if (v === null || v === undefined)
      return <span className="v-null">null</span>;
    if (typeof v === "boolean")
      return <span className="v-bool">{String(v)}</span>;
    if (typeof v === "number")
      return <span className="v-num">{String(v)}</span>;
    if (typeof v === "string") return <span className="v-str">{v}</span>;
    return <span>{JSON.stringify(v)}</span>;
  }

  return (
    <div className="json-table-host">
      <table className="json-table">
        <thead>
          <tr>
            {keys.map((k) => (
              <th key={k}>{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {keys.map((k) => (
                <td key={k} title={typeof row[k] === "object" ? JSON.stringify(row[k]) : String(row[k] ?? "")}>
                  {renderCell(row[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FullscreenButton({ active, onToggle }) {
  return (
    <button
      type="button"
      className="copy-btn"
      onClick={onToggle}
      aria-label={active ? "Exit fullscreen" : "Fullscreen output"}
      title={active ? "Exit fullscreen (Esc)" : "Fullscreen output"}
    >
      {active ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 14 10 14 10 20" />
          <polyline points="20 10 14 10 14 4" />
          <line x1="14" y1="10" x2="21" y2="3" />
          <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 3 21 3 21 9" />
          <polyline points="9 21 3 21 3 15" />
          <line x1="21" y1="3" x2="14" y2="10" />
          <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
      )}
      {active ? "Exit" : ""}
    </button>
  );
}

function ImageButton({ targetRef, language, disabled }) {
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (!targetRef?.current || disabled || busy) return;
    setBusy(true);
    const node = targetRef.current;
    node.classList.add("snapshot");
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor:
          getComputedStyle(document.documentElement)
            .getPropertyValue("--surface")
            .trim() || "#ffffff",
      });
      const a = document.createElement("a");
      a.download = `pretty-lush-${language.toLowerCase()}.png`;
      a.href = dataUrl;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      // swallow — fail silently is acceptable for an optional export
    } finally {
      node.classList.remove("snapshot");
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="copy-btn"
      onClick={handleSave}
      disabled={disabled || busy}
      aria-label="Download as image"
      title="Download as PNG"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
      {busy ? "…" : "PNG"}
    </button>
  );
}

function ErrorCard({ error, language }) {
  return (
    <div className="error-card">
      <div className="error-head">
        <span className="error-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </span>
        <span className="error-title">Couldn’t format</span>
        <span className="error-lang">{language}</span>
      </div>

      <div className="error-msg">{error.message}</div>

      {(error.line || error.hint) && (
        <div className="error-meta">
          {error.line && (
            <span className="error-loc">
              line <b>{error.line}</b>
              {error.column ? `, column ${error.column}` : ""}
            </span>
          )}
          {error.hint && <span className="error-hint">{error.hint}</span>}
        </div>
      )}
    </div>
  );
}
