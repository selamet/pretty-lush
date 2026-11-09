import { useState } from "react";
import { countDiagnostics } from "../lint/ruff-diagnostics.js";

// Compact, collapsible list of Ruff diagnostics under the input editor.
// Clicking a row moves the caret to the diagnostic (`onJump`).
export default function ProblemsPanel({ lint, onJump }) {
  const [open, setOpen] = useState(true);
  const { diagnostics, status } = lint;
  const { errors, total } = countDiagnostics(diagnostics);
  const listId = "lint-problems-list";

  let summary;
  if (status === "loading") summary = "Loading Ruff…";
  else if (status === "error") summary = "Lint unavailable";
  else if (total === 0) summary = "No problems";
  else summary = null;

  return (
    <div className={`problems ${open ? "is-open" : ""}`}>
      <button
        type="button"
        className="problems-head"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        title={open ? "Collapse problems" : "Expand problems"}
      >
        <svg
          className="problems-chevron"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="9 6 15 12 9 18" />
        </svg>
        <span className="problems-title">Problems</span>
        <span
          className={`problems-count ${errors ? "has-errors" : total ? "has-warnings" : ""}`}
          aria-label={`${total} ${total === 1 ? "problem" : "problems"}`}
        >
          {status === "ready" ? total : "–"}
        </span>
        <span className="problems-source">Ruff</span>
        {summary && <span className="problems-summary">{summary}</span>}
      </button>
      {open && total > 0 && (
        <ul className="problems-list" id={listId} aria-label="Lint problems">
          {diagnostics.map((d, i) => (
            <li key={`${d.from}-${d.code}-${i}`}>
              <button
                type="button"
                className={`problem is-${d.severity}`}
                onClick={() => onJump(d)}
                title={`Go to line ${d.line}, column ${d.column}`}
              >
                <span className="problem-code">{d.code}</span>
                <span className="problem-msg">{d.message}</span>
                <span className="problem-pos">
                  {d.line}:{d.column}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
