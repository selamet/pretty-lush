import { CURL_TARGETS } from "../curl/index.js";

// Sub-toolbar under the output pane head while "cURL → code" is on: target
// switcher (fetch / axios / requests) and a close button that returns to the
// normal formatted output. Options the converter skipped are listed below it.
export default function CurlBar({ target, warnings = [], onChange, onClose }) {
  return (
    <>
      <div className="json-bar typegen-bar curl-bar">
        <span className="json-bar-label curl-bar-label">cURL →</span>
        <div className="view-toggle small typegen-targets" role="group" aria-label="cURL conversion target">
          {CURL_TARGETS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={target === t.id}
              className={target === t.id ? "on" : ""}
              title={`Convert to ${t.label}`}
              onClick={() => onChange({ target: t.id })}
            >
              {t.short}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="json-bar-clear"
          onClick={onClose}
          title="Back to formatted output"
          aria-label="Close cURL conversion and show formatted output"
        >
          ×
        </button>
      </div>
      {warnings.length > 0 && (
        <div className="curl-warnings" role="status">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <ul>
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
