import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Format ids / labels mirror CONFIG_FORMATS in src/config-import/index.js;
// the module itself is loaded on first "Review" to keep it out of the main
// chunk (it pulls in the YAML / TOML parsers lazily as well).
const FORMATS = [
  ["auto", "Auto-detect"],
  ["prettier", ".prettierrc (JSON / YAML / TOML)"],
  ["package-json", 'package.json ("prettier" key)'],
  ["editorconfig", ".editorconfig"],
  ["ruff", "ruff.toml"],
  ["pyproject", "pyproject.toml [tool.ruff]"],
];

const PLACEHOLDER = `{
  "semi": false,
  "singleQuote": true,
  "printWidth": 100
}`;

const loadImporter = () => import("../config-import/index.js");

// "Import formatter config" dialog: paste, pick or drop a config file,
// review what maps to which setting (and what is ignored), then apply.
// `onApply(result)` receives the importConfig() result.
export default function ImportConfigDialog({ open, onClose, onApply, activeProfile }) {
  const [text, setText] = useState("");
  const [filename, setFilename] = useState("");
  const [format, setFormat] = useState("auto");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [labels, setLabels] = useState(null);
  const textRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setText("");
    setFilename("");
    setFormat("auto");
    setResult(null);
    setError(null);
    setDragOver(false);
    setTimeout(() => textRef.current?.focus(), 0);
  }, [open]);

  if (!open) return null;

  function reset(nextText, nextFilename = filename) {
    setText(nextText);
    setFilename(nextFilename);
    setResult(null);
    setError(null);
  }

  async function loadFile(file) {
    if (!file) return;
    try {
      reset(await file.text(), file.name);
    } catch {
      setError("Couldn't read that file");
    }
  }

  async function review() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const mod = await loadImporter();
      if (!labels) setLabels({ setting: mod.SETTING_LABELS, describe: mod.describeSetting });
      setResult(await mod.importConfig(text, { filename, format }));
    } catch (e) {
      setResult(null);
      setError(e?.name === "ConfigImportError" ? e.message : `Import failed: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    if (!result || !result.applied.length) return;
    onApply(result);
  }

  function handleKey(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (result) apply();
      else review();
    }
  }

  // Keep drops inside the dialog from reaching the app-wide file drop,
  // which would load the file into the editor.
  const dropHandlers = {
    onDragOver(e) {
      e.stopPropagation();
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
        setDragOver(true);
      }
    },
    onDragLeave(e) {
      e.stopPropagation();
      if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false);
    },
    onDrop(e) {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      loadFile(e.dataTransfer?.files?.[0]);
    },
  };

  const formatName = FORMATS.find(([id]) => id === result?.format)?.[1];
  const appliedCount = result?.applied.length ?? 0;

  return createPortal(
    <div className="dialog-overlay" onMouseDown={onClose} {...dropHandlers}>
      <div
        className="dialog import-dialog"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={handleKey}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-config-title"
      >
        <div className="dialog-head">
          <h2 id="import-config-title" className="dialog-title">
            Import formatter config
          </h2>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="dialog-body">
          <div className="dialog-row">
            <label className="dialog-label" htmlFor="import-config-text">
              Paste a config, or drop / choose a file
            </label>
            <div className={`import-drop ${dragOver ? "is-over" : ""}`}>
              <textarea
                id="import-config-text"
                ref={textRef}
                className="dialog-input import-text"
                value={text}
                onChange={(e) => reset(e.target.value)}
                placeholder={PLACEHOLDER}
                spellCheck={false}
                rows={7}
              />
              {dragOver && <div className="import-drop-hint">Drop to load the file</div>}
            </div>
            <div className="import-file-row">
              <button type="button" className="copy-btn" onClick={() => fileRef.current?.click()}>
                Choose file…
              </button>
              <input
                ref={fileRef}
                type="file"
                className="visually-hidden"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => {
                  loadFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              {filename ? (
                <span className="import-file-name" title={filename}>
                  {filename}
                  <button
                    type="button"
                    className="import-file-clear"
                    onClick={() => reset(text, "")}
                    aria-label="Forget file name"
                  >
                    ×
                  </button>
                </span>
              ) : (
                <span className="import-file-types">
                  .prettierrc · package.json · .editorconfig · ruff.toml · pyproject.toml
                </span>
              )}
            </div>
          </div>

          <div className="dialog-row">
            <label className="dialog-label" htmlFor="import-config-format">
              Format
            </label>
            <select
              id="import-config-format"
              className="popover-select"
              value={format}
              onChange={(e) => {
                setFormat(e.target.value);
                setResult(null);
                setError(null);
              }}
            >
              {FORMATS.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="dialog-error" role="alert">
              {error}
            </div>
          )}

          {result && labels && (
            <div className="import-summary" aria-live="polite">
              <div className="import-summary-head">
                Read as <b>{formatName}</b>
              </div>
              {appliedCount ? (
                <ul className="import-list">
                  {result.applied.map((a) => (
                    <li key={a.setting} className="import-item is-applied">
                      <span className="import-mark" aria-hidden="true">✓</span>
                      <code>{a.option}</code>
                      <span className="import-arrow" aria-hidden="true">→</span>
                      <span>
                        {labels.setting[a.setting]}: {labels.describe(a.setting, a.settingValue)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="dialog-hint dialog-hint-warn">No supported options found.</p>
              )}
              {result.ignored.length > 0 && (
                <>
                  <div className="import-summary-sub">Ignored ({result.ignored.length})</div>
                  <ul className="import-list">
                    {result.ignored.map((i, idx) => (
                      <li key={`${i.option}-${idx}`} className="import-item is-ignored">
                        <span className="import-mark" aria-hidden="true">–</span>
                        <code>{i.option}</code>
                        <span className="import-reason">{i.reason}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          <p className="dialog-hint">
            Options are applied to the active profile <b>{activeProfile}</b>. Save a new
            profile first to keep the current one unchanged.
          </p>
        </div>

        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          {result ? (
            <button
              type="button"
              className="btn-primary btn"
              onClick={apply}
              disabled={!appliedCount}
            >
              Apply {appliedCount} {appliedCount === 1 ? "option" : "options"}
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary btn"
              onClick={review}
              disabled={busy || !text.trim()}
            >
              {busy ? "Reading…" : "Review"}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
