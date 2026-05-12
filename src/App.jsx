import { useEffect, useMemo, useState } from "react";
import { formatCode } from "./formatters.js";
import CodeEditor from "./CodeEditor.jsx";
import DiffView from "./DiffView.jsx";
import CommandPalette from "./CommandPalette.jsx";
import ShareDialog, { PasswordPrompt } from "./ShareDialog.jsx";
import { encryptShare, decryptShare } from "./crypto.js";
import { THEMES, getThemeMeta, flipTheme } from "./themes.js";

const EXT_TO_LANG = {
  py: "python",
  pyw: "python",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  html: "html",
  htm: "html",
  css: "css",
  scss: "css",
  md: "markdown",
  markdown: "markdown",
  dockerfile: "dockerfile",
  env: "dotenv",
};

function detectLangFromContent(src) {
  const text = src.trim();
  if (!text || text.length < 20) return null;
  const head = text.slice(0, 4000);
  const firstLine = head.split("\n", 1)[0];

  if (/^#!\s*\/.*\b(bash|sh|zsh)\b/m.test(head)) return "shell";
  if (/^FROM\s+\S+/m.test(head) && /^(RUN|CMD|COPY|EXPOSE|ENV|WORKDIR)\b/m.test(head))
    return "dockerfile";
  if (/^<\?xml|^<!doctype\s+html|^<html\b|^<!DOCTYPE/i.test(firstLine.trim()))
    return "html";
  if (/^---\s*$/m.test(head) || /^[a-z_][\w-]*:\s/m.test(head)) {
    // YAML if also no curly-brace JSON markers
    if (!/^\s*[\{\[]/.test(text) && !/[\{\}]/.test(firstLine)) return "yaml";
  }
  if (/^\s*[\{\[]/.test(text)) {
    try {
      JSON.parse(text);
      return "json";
    } catch {}
  }
  if (/^(def|class|import|from)\s+\w/m.test(head) || /^\s+\w.*:\s*$/m.test(head))
    return "python";
  {
    const lines = head.split("\n").map((l) => l.trim()).filter(Boolean);
    const meaningful = lines.filter((l) => !l.startsWith("#"));
    if (meaningful.length >= 2) {
      const envLike = meaningful.filter((l) =>
        /^(export\s+)?[A-Z_][A-Z0-9_]*\s*=/i.test(l)
      );
      if (envLike.length === meaningful.length) return "dotenv";
    }
  }
  if (
    /^(interface|type)\s+\w/m.test(head) ||
    /:\s*(string|number|boolean|any)\b/.test(head)
  )
    return "typescript";
  if (
    /^(const|let|var|function|export|import)\b/m.test(head) ||
    /=>\s*[\{(]/m.test(head)
  )
    return "javascript";
  if (/^#{1,6}\s+\S/m.test(head) || /\[[^\]]+\]\([^)]+\)/.test(head))
    return "markdown";
  if (/^[\w*.#:-]+\s*\{[^}]*[:;]/m.test(head)) return "css";

  return null;
}

// URL share encoding ──────────────────────────────────────────
function encodeShare(state) {
  const json = JSON.stringify(state);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeShare(hash) {
  try {
    let b64 = hash.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const json = decodeURIComponent(escape(atob(b64)));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function detectLangFromFilename(name) {
  if (!name) return null;
  const base = name.toLowerCase();
  if (base === "dockerfile" || base.endsWith(".dockerfile")) return "dockerfile";
  if (base === ".env" || base.startsWith(".env.")) return "dotenv";
  const dot = base.lastIndexOf(".");
  if (dot < 0) return null;
  return EXT_TO_LANG[base.slice(dot + 1)] || null;
}

const LANGUAGES = [
  { id: "python", label: "Python", ext: "py" },
  { id: "json", label: "JSON", ext: "json" },
  { id: "yaml", label: "YAML", ext: "yaml" },
  { id: "shell", label: "Shell", ext: "sh" },
  { id: "dockerfile", label: "Dockerfile", ext: "" },
  { id: "javascript", label: "JavaScript", ext: "js" },
  { id: "typescript", label: "TypeScript", ext: "ts" },
  { id: "html", label: "HTML", ext: "html" },
  { id: "css", label: "CSS", ext: "css" },
  { id: "markdown", label: "Markdown", ext: "md" },
  { id: "dotenv", label: "Dotenv", ext: "env" },
];

const SAMPLES = {
  python: `def greet(name,age=18):\n    return f"hi {name}, {age}"\nprint( greet("ada") )`,
  json: `{"name":"pretty-lush","langs":["py","json","yaml","sh"],"version":1}`,
  yaml: `name: pretty-lush\nlangs:\n - py\n - json\nactive: true`,
  shell: `#!/usr/bin/env bash\nset -e\nfor f in *.py;do\necho "$f"\ndone`,
  dockerfile: `FROM python:3.11-slim\nWORKDIR  /app\nCOPY . .\nRUN pip install -r requirements.txt\nCMD ["python","app.py"]`,
  javascript: `const greet=(name,age=18)=>{\nreturn \`hi \${name}, \${age}\`\n}\nconsole.log(greet("ada"))`,
  typescript: `type User={name:string;age?:number}\nconst greet=(u:User)=>\`hi \${u.name}\`\nconsole.log(greet({name:"ada"}))`,
  html: `<!doctype html><html><head><title>x</title></head><body><h1>hello</h1><p>world</p></body></html>`,
  css: `body{margin:0;font-family:system-ui}.btn{background:#1f6f4a;color:#fff;padding:8px 12px;border-radius:6px}`,
  markdown: `# pretty-lush\n\nA formatter for **JSON**,YAML,Python and more.\n\n- fast\n- private\n-  in your browser`,
  dotenv: `# pretty-lush sample env\nNODE_ENV =production\nPORT= 3000\nDATABASE_URL="postgres://user:pass@localhost:5432/db"\n  API_KEY=  sk_live_abc123\nFEATURE_FLAG=true`,
};

const STORAGE_KEY = "pretty-lush:state:v1";
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

  const [viewMode, setViewMode] = useState("split"); // "split" | "diff"
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

  async function handleCreateShare({ mode, password, ttl }) {
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
      const result = await formatCode(lang, input, settings);
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

      <div className="workspace">
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

        <section className={`editor ${viewMode === "diff" ? "is-diff" : ""}`}>
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
          ) : (
            <>
          <div className="pane">
            <div className="pane-head">
              <span className="title">Input</span>
              <span className="meta">
                {stats.inLines} {stats.inLines === 1 ? "line" : "lines"}
              </span>
            </div>
            <div className="editor-host">
              <CodeEditor theme={settings.editorTheme}
                value={input}
                onChange={setInput}
                language={lang}
                placeholder={`Paste ${currentLang.label} here…`}
                errorLine={error?.line ?? null}
              />
            </div>
          </div>

          <div className="pane">
            <div className="pane-head">
              <span className="title">Output</span>
              <div className="pane-actions">
                <span className="meta">
                  {output ? `${stats.outLines} lines` : "—"}
                </span>
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
