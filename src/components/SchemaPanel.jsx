import { useRef, useState } from "react";
import CodeEditor from "./CodeEditor.jsx";
import { DIALECTS } from "../schema/validate.js";

const LIST_ID = "schema-errors-list";

function Chevron() {
  return (
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
  );
}

// Badge + one-line summary for the panel head.
function headStatus(v) {
  if (!v || v.status === "loading") return { badge: "–", tone: "", summary: "Validating…" };
  switch (v.status) {
    case "empty":
      return { badge: "–", tone: "", summary: "Paste a JSON Schema below" };
    case "valid":
      return { badge: "✓", tone: "is-valid", summary: "Valid" };
    case "invalid":
      return {
        badge: String(v.errors.length),
        tone: "has-errors",
        summary: `${v.errors.length} ${v.errors.length === 1 ? "error" : "errors"}`,
      };
    case "schema-error":
      return { badge: "!", tone: "has-errors", summary: "Schema problem" };
    case "input-error":
      return { badge: "!", tone: "has-warnings", summary: "Input is not valid JSON" };
    default:
      return { badge: "–", tone: "", summary: null };
  }
}

/**
 * JSON Schema validation panel under the JSON input editor: a collapsible
 * schema editor plus the validation result (success state, schema / input
 * problems or the list of errors — click one to jump to it in the input).
 *
 * @param {object} props
 * @param {string} props.schemaText
 * @param {(text: string) => void} props.onSchemaChange
 * @param {null | object} props.validation  result of useSchemaValidation
 * @param {(err: { from: number, to: number }) => void} props.onJump
 * @param {() => void} props.onGenerate  replace the schema with one inferred from the input
 * @param {() => void} props.onClose     turn validation off
 */
export default function SchemaPanel({
  theme,
  schemaText,
  onSchemaChange,
  validation,
  onJump,
  onGenerate,
  onClose,
}) {
  const [editorOpen, setEditorOpen] = useState(true);
  const schemaViewRef = useRef(null);
  const { badge, tone, summary } = headStatus(validation);
  const status = validation?.status;
  const dialect = validation?.dialect ? DIALECTS[validation.dialect]?.label : null;

  function jumpInSchema(line, column) {
    const view = schemaViewRef.current;
    if (!view || !line) return;
    setEditorOpen(true);
    const ln = view.state.doc.line(Math.min(line, view.state.doc.lines));
    const pos = Math.min(ln.from + Math.max(0, (column || 1) - 1), ln.to);
    view.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
    view.focus();
  }

  return (
    <section
      className={`schema-panel problems ${editorOpen ? "is-open" : ""}`}
      aria-label="JSON Schema validation"
    >
      <div className="schema-head">
        <button
          type="button"
          className="problems-head schema-toggle"
          aria-expanded={editorOpen}
          aria-controls="schema-editor"
          onClick={() => setEditorOpen((v) => !v)}
          title={editorOpen ? "Collapse schema editor" : "Expand schema editor"}
        >
          <Chevron />
          <span className="problems-title">Schema</span>
          <span
            className={`problems-count ${tone}`}
            aria-hidden="true"
          >
            {badge}
          </span>
          <span className={`problems-summary ${status === "valid" ? "is-valid" : ""}`} role="status">
            {summary}
          </span>
          {dialect && <span className="problems-source">{dialect}</span>}
        </button>
        <button
          type="button"
          className="schema-action"
          onClick={onGenerate}
          title="Replace the schema with one generated from the current JSON"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
          </svg>
          <span className="schema-action-text">Generate</span>
        </button>
        <button
          type="button"
          className="json-bar-clear schema-close"
          onClick={onClose}
          title="Turn off schema validation"
          aria-label="Turn off schema validation"
        >
          ×
        </button>
      </div>

      <div className="schema-editor editor-host" id="schema-editor" hidden={!editorOpen}>
        <CodeEditor
          theme={theme}
          value={schemaText}
          onChange={onSchemaChange}
          language="json"
          placeholder='{ "type": "object", … }  — paste a JSON Schema (draft-07 or 2020-12)'
          errorLine={status === "schema-error" ? validation.error.line : null}
          onViewReady={(view) => {
            schemaViewRef.current = view;
          }}
        />
      </div>

      {(status === "schema-error" || status === "input-error") && (
        <div className={`schema-message ${status === "schema-error" ? "is-error" : ""}`}>
          {validation.error.line && status === "schema-error" ? (
            <button
              type="button"
              className="schema-message-text as-link"
              onClick={() => jumpInSchema(validation.error.line, validation.error.column)}
              title={`Go to line ${validation.error.line} of the schema`}
            >
              {validation.error.message}
            </button>
          ) : (
            <span className="schema-message-text">{validation.error.message}</span>
          )}
          {validation.error.hint && <span className="schema-message-hint">{validation.error.hint}</span>}
        </div>
      )}

      {status === "valid" && (
        <div className="schema-message is-valid">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span className="schema-message-text">Valid against schema</span>
        </div>
      )}

      {status === "invalid" && (
        <ul className="problems-list schema-errors" id={LIST_ID} aria-label="Schema validation errors">
          {validation.errors.map((e, i) => (
            <li key={`${e.from}-${e.keyword}-${i}`}>
              <button
                type="button"
                className="problem is-error schema-error"
                onClick={() => onJump(e)}
                title={`Go to ${e.instancePath || "the document root"} (line ${e.line}, column ${e.column})`}
              >
                <span className="problem-code schema-error-path">{e.instancePath || "/"}</span>
                <span className="problem-msg">{e.message}</span>
                <span className="problem-pos">{e.keyword}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
