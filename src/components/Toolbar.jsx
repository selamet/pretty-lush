import { LANGUAGES } from "../languages/registry.js";
import SettingsPopover from "./SettingsPopover.jsx";

// Toolbar under the header: view-mode tabs, mobile language picker,
// formatter options, "more options" popover, Share and Format.
export default function Toolbar({
  viewMode,
  onViewModeChange,
  diffDisabled,
  lang,
  onSelectLang,
  settings,
  setSettings,
  settingsOpen,
  setSettingsOpen,
  onShare,
  shareDisabled,
  onFormat,
  isFormatting,
}) {
  return (
    <div className="toolbar">
      <div className="seg-tabs" role="tablist" aria-label="View mode">
        {[
          { id: "split", label: "Format", title: "Side-by-side view" },
          { id: "diff", label: "Diff", title: "Diff input ↔ output", disabled: diffDisabled },
          { id: "compare", label: "Compare", title: "Compare two snippets" },
        ].map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={viewMode === m.id}
            className={viewMode === m.id ? "on" : ""}
            onClick={() => onViewModeChange(m.id)}
            title={m.title}
            disabled={m.disabled}
          >
            {m.label}
          </button>
        ))}
      </div>

      <select
        className="lang-select mobile-only"
        value={lang}
        onChange={(e) => onSelectLang(e.target.value)}
        aria-label="Language"
      >
        {LANGUAGES.map((l) => (
          <option key={l.id} value={l.id}>
            {l.label}
          </option>
        ))}
      </select>

      <div className="toolbar-options">
        <div className="opt">
          <span className="opt-label">Indent</span>
          <div className="mini-seg">
            {[2, 4, "tab"].map((v) => (
              <button
                key={String(v)}
                type="button"
                aria-pressed={settings.indent === v}
                className={settings.indent === v ? "on" : ""}
                onClick={() => setSettings((s) => ({ ...s, indent: v }))}
              >
                {v === "tab" ? "Tab" : v}
              </button>
            ))}
          </div>
        </div>
        <div className="opt">
          <span className="opt-label">Quotes</span>
          <div className="mini-seg">
            {[
              ["double", '"'],
              ["single", "'"],
              ["preserve", "auto"],
            ].map(([q, label]) => (
              <button
                key={q}
                type="button"
                aria-pressed={settings.quotes === q}
                className={settings.quotes === q ? "on" : ""}
                onClick={() => setSettings((s) => ({ ...s, quotes: q }))}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <label className="opt">
          <span className="opt-label">Width</span>
          <input
            type="number"
            className="opt-input"
            min="40"
            max="200"
            step="2"
            value={settings.lineWidth}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n > 0)
                setSettings((s) => ({ ...s, lineWidth: n }));
            }}
          />
        </label>
        <button
          type="button"
          role="switch"
          aria-checked={settings.autoFormat}
          className="opt-switch"
          onClick={() => setSettings((s) => ({ ...s, autoFormat: !s.autoFormat }))}
          title="Format on every change, after 800ms"
        >
          <span className={`switch ${settings.autoFormat ? "on" : ""}`} aria-hidden="true">
            <span className="knob" />
          </span>
          Format as I type
        </button>
        {lang === "python" && (
          <button
            type="button"
            role="switch"
            aria-checked={!!settings.lint}
            className="opt-switch"
            onClick={() => setSettings((s) => ({ ...s, lint: !s.lint }))}
            title="Show Ruff lint diagnostics in the input editor"
          >
            <span className={`switch ${settings.lint ? "on" : ""}`} aria-hidden="true">
              <span className="knob" />
            </span>
            Lint
          </button>
        )}
      </div>

      <div className="toolbar-actions">
        <div className="settings-wrap">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setSettingsOpen((v) => !v)}
            aria-label="More options"
            title="More options"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
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
          className="btn"
          onClick={onShare}
          disabled={shareDisabled}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          Share
        </button>
        <button
          className="btn-primary btn"
          onClick={onFormat}
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
    </div>
  );
}
