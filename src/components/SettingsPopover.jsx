import { useEffect } from "react";
import { THEMES } from "../editor-themes.js";

// "More options" popover anchored in the toolbar. Closes on outside click / Escape.
export default function SettingsPopover({ settings, onChange, onClose }) {
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
    <div className="popover" role="dialog" aria-label="More options">
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
