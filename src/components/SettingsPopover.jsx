import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { THEMES } from "../editor-themes.js";
import { DEFAULT_PROFILE } from "../state/profiles.js";

const PRETTIER_SELECTS = [
  {
    key: "trailingComma",
    label: "Trailing commas",
    options: [
      ["all", "All"],
      ["es5", "ES5"],
      ["none", "None"],
    ],
  },
  {
    key: "arrowParens",
    label: "Arrow parens",
    options: [
      ["always", "Always"],
      ["avoid", "Avoid"],
    ],
  },
  {
    key: "proseWrap",
    label: "Prose wrap",
    options: [
      ["preserve", "Preserve"],
      ["always", "Always"],
      ["never", "Never"],
    ],
  },
  {
    key: "endOfLine",
    label: "Line endings",
    options: [
      ["lf", "LF"],
      ["crlf", "CRLF"],
      ["cr", "CR"],
      ["auto", "Auto"],
    ],
  },
];

// "More options" popover anchored in the toolbar: settings profile, editor
// theme, Prettier options, Python overrides and config import. Closes on
// outside click / Escape. `startSaving` opens it with the "save as profile"
// name input focused (⌘K → "Save settings as profile…").
export default function SettingsPopover({
  settings,
  onChange,
  onClose,
  profiles,
  onImport,
  startSaving = false,
}) {
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

  // Cap the height to the space below the popover so it scrolls instead of
  // running off short / phone screens.
  const popRef = useRef(null);
  useLayoutEffect(() => {
    function fit() {
      const el = popRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      el.style.maxHeight = `${Math.max(200, window.innerHeight - top - 12)}px`;
    }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  function set(key, value) {
    onChange({ ...settings, [key]: value });
  }

  const pythonOverrides = [
    settings.pythonLineWidth != null && `${settings.pythonLineWidth} cols`,
    settings.pythonIndent != null &&
      (settings.pythonIndent === "tab" ? "tabs" : `${settings.pythonIndent} spaces`),
    settings.pythonQuotes != null && `${settings.pythonQuotes} quotes`,
  ].filter(Boolean);

  return (
    <div ref={popRef} className="popover settings-popover" role="dialog" aria-label="More options">
      <ProfileSection profiles={profiles} startSaving={startSaving} />

      <div className="popover-row">
        <label htmlFor="settings-theme">Editor theme</label>
        <select
          id="settings-theme"
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
          aria-label="Format on paste"
        >
          <span className="knob" />
        </button>
      </div>

      <div className="popover-section" role="group" aria-labelledby="settings-prettier">
        <div className="popover-section-title" id="settings-prettier">
          JS / TS / CSS / Markdown
        </div>
        <div className="popover-grid">
          <PopoverSwitch
            label="Semicolons"
            on={settings.semi !== false}
            onToggle={() => set("semi", settings.semi === false)}
          />
          <PopoverSwitch
            label="Bracket spacing"
            on={settings.bracketSpacing !== false}
            onToggle={() => set("bracketSpacing", settings.bracketSpacing === false)}
          />
          {PRETTIER_SELECTS.map((s) => (
            <div className="popover-grid-row" key={s.key}>
              <label htmlFor={`settings-${s.key}`}>{s.label}</label>
              <select
                id={`settings-${s.key}`}
                className="popover-select popover-select-sm"
                value={settings[s.key]}
                onChange={(e) => set(s.key, e.target.value)}
              >
                {s.options.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {pythonOverrides.length > 0 && (
        <div className="popover-section popover-python">
          <div className="popover-section-title">Python (Ruff)</div>
          <div className="popover-python-row">
            <span className="popover-python-val">{pythonOverrides.join(" · ")}</span>
            <button
              type="button"
              className="copy-btn"
              onClick={() =>
                onChange({
                  ...settings,
                  pythonIndent: null,
                  pythonLineWidth: null,
                  pythonQuotes: null,
                })
              }
              title="Use the toolbar indent / width / quotes for Python too"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      <button type="button" className="btn popover-import" onClick={onImport}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Import config…
      </button>

      <div className="popover-foot">Applies on next Format (⌘⏎).</div>
    </div>
  );
}

function PopoverSwitch({ label, on, onToggle }) {
  return (
    <div className="popover-grid-row">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        className={`switch ${on ? "on" : ""}`}
        onClick={onToggle}
      >
        <span className="knob" />
      </button>
    </div>
  );
}

// Profile picker with inline save-as / rename / delete. `mode` is
// "view" | "save" | "rename" | "delete".
function ProfileSection({ profiles, startSaving }) {
  const [mode, setMode] = useState(startSaving ? "save" : "view");
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const isDefault = profiles.active === DEFAULT_PROFILE;

  useEffect(() => {
    if (startSaving) begin("save");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startSaving]);

  useEffect(() => {
    if (mode === "save" || mode === "rename") inputRef.current?.focus();
  }, [mode]);

  function begin(next) {
    setMode(next);
    setError(null);
    setName(next === "rename" ? profiles.active : "");
  }

  function submit(e) {
    e.preventDefault();
    const err =
      mode === "save" ? profiles.save(name) : profiles.rename(profiles.active, name);
    if (err) {
      setError(err);
      inputRef.current?.focus();
      return;
    }
    setMode("view");
  }

  function onInputKey(e) {
    if (e.key === "Escape") {
      // Cancel the edit, keep the popover open.
      e.stopPropagation();
      e.preventDefault();
      setMode("view");
    }
  }

  return (
    <div className="popover-row profile-section">
      <label htmlFor="settings-profile">
        Profile
        {mode === "view" && <span className="val">{profiles.active}</span>}
      </label>

      {mode === "view" && (
        <div className="profile-bar">
          <select
            id="settings-profile"
            className="popover-select"
            value={profiles.active}
            onChange={(e) => profiles.switchTo(e.target.value)}
          >
            {profiles.names.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="profile-icon-btn"
            onClick={() => begin("save")}
            aria-label="Save settings as a new profile"
            title="Save as new profile"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button
            type="button"
            className="profile-icon-btn"
            onClick={() => begin("rename")}
            disabled={isDefault}
            aria-label="Rename profile"
            title={isDefault ? "The Default profile can't be renamed" : "Rename profile"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
          <button
            type="button"
            className="profile-icon-btn"
            onClick={() => begin("delete")}
            disabled={isDefault}
            aria-label="Delete profile"
            title={isDefault ? "The Default profile can't be deleted" : "Delete profile"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        </div>
      )}

      {(mode === "save" || mode === "rename") && (
        <form className="profile-form" onSubmit={submit}>
          <input
            ref={inputRef}
            id="settings-profile"
            className="dialog-input profile-input"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            onKeyDown={onInputKey}
            placeholder={mode === "save" ? "New profile name" : "Profile name"}
            aria-label={mode === "save" ? "New profile name" : "New name for the profile"}
            aria-invalid={!!error}
            aria-describedby={error ? "profile-error" : undefined}
            maxLength={60}
            autoComplete="off"
          />
          <div className="profile-form-actions">
            <button type="button" className="copy-btn" onClick={() => setMode("view")}>
              Cancel
            </button>
            <button type="submit" className="copy-btn profile-primary">
              {mode === "save" ? "Save" : "Rename"}
            </button>
          </div>
          {error && (
            <div className="profile-error" id="profile-error" role="alert">
              {error}
            </div>
          )}
          {mode === "save" && !error && (
            <div className="profile-hint">Saves the current formatter options.</div>
          )}
        </form>
      )}

      {mode === "delete" && (
        <div className="profile-confirm" role="alert">
          <span>
            Delete <b>{profiles.active}</b>? Settings switch to Default.
          </span>
          <div className="profile-form-actions">
            <button type="button" className="copy-btn" onClick={() => setMode("view")} autoFocus>
              Cancel
            </button>
            <button
              type="button"
              className="copy-btn profile-danger"
              onClick={() => {
                profiles.remove(profiles.active);
                setMode("view");
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
