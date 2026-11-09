import { TYPEGEN_TARGETS } from "../codegen/index.js";

// Sub-toolbar under the output pane head while "Generate types" is on:
// target switcher (TS / Zod / Pydantic), root type name and a close button
// that returns to the normal formatted output.
export default function TypegenBar({ target, rootName, onChange, onClose }) {
  return (
    <div className="json-bar typegen-bar">
      <div className="view-toggle small typegen-targets" role="group" aria-label="Type generation target">
        {TYPEGEN_TARGETS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={target === t.id}
            className={target === t.id ? "on" : ""}
            title={`Generate ${t.label}`}
            onClick={() => onChange({ target: t.id })}
          >
            {t.short}
          </button>
        ))}
      </div>
      <label className="json-bar-label typegen-root-label" htmlFor="typegen-root">
        Root
      </label>
      <input
        id="typegen-root"
        className="json-bar-input typegen-root-input"
        spellCheck={false}
        autoComplete="off"
        maxLength={64}
        placeholder="Root"
        aria-label="Root type name"
        value={rootName}
        onChange={(e) => onChange({ rootName: e.target.value })}
      />
      <button
        type="button"
        className="json-bar-clear"
        onClick={onClose}
        title="Back to formatted output"
        aria-label="Close type generation and show formatted output"
      >
        ×
      </button>
    </div>
  );
}
