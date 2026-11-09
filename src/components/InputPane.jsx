import { useRef } from "react";
import CodeEditor from "./CodeEditor.jsx";
import ProblemsPanel from "./ProblemsPanel.jsx";
import SchemaPanel from "./SchemaPanel.jsx";

// Left pane of the "Format" view: the input editor, plus the JSONPath bar
// and the JSON Schema toggle / panel when the language is JSON, and the Ruff
// problems list when lint is on.
//
// `schema` is null unless validation is on (JSON input, split view):
// { text, onChange, validation, onGenerate }; `onSchemaToggle` turns it on
// or off.
export default function InputPane({
  language,
  theme,
  input,
  onInputChange,
  error,
  jsonPath,
  onJsonPathChange,
  onFormat,
  lint = null,
  schema = null,
  onSchemaToggle,
  onViewReady,
  onEditorFocus,
  // Changes per snippet tab: the editor is re-created (synchronously, no
  // flicker) so each tab gets its own undo history and selection.
  editorKey,
}) {
  const viewRef = useRef(null);
  const inLines = input.split("\n").length;
  const isJson = language.id === "json";

  function jumpTo({ from, to }) {
    const view = viewRef.current;
    if (!view) return;
    const len = view.state.doc.length;
    view.dispatch({
      selection: { anchor: Math.min(from, len), head: Math.min(to, len) },
      scrollIntoView: true,
    });
    view.focus();
  }

  return (
    <div className="pane">
      <div className="pane-head">
        <span className="title">Input</span>
        <div className="pane-actions">
          <span className="meta">
            {inLines} {inLines === 1 ? "line" : "lines"}
          </span>
          {isJson && onSchemaToggle && (
            <button
              type="button"
              className={`copy-btn schema-btn ${schema ? "is-on" : ""}`}
              aria-pressed={!!schema}
              aria-label="Validate against JSON Schema"
              title={schema ? "Turn off schema validation" : "Validate this JSON against a JSON Schema"}
              onClick={onSchemaToggle}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
              <span className="schema-btn-text">Schema</span>
            </button>
          )}
        </div>
      </div>
      {isJson && (
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
            onChange={(e) => onJsonPathChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onFormat();
              }
            }}
            placeholder="$.foo.bar  ·  $..name  ·  $.items[*].id"
          />
          {jsonPath && (
            <button
              type="button"
              className="json-bar-clear"
              onClick={() => onJsonPathChange("")}
              title="Clear path"
              aria-label="Clear JSONPath"
            >
              ×
            </button>
          )}
        </div>
      )}
      <div className="editor-host" onFocus={onEditorFocus}>
        <CodeEditor
          key={editorKey}
          theme={theme}
          value={input}
          onChange={onInputChange}
          language={language.id}
          placeholder={`Paste ${language.label} here…`}
          errorLine={error?.line ?? null}
          diagnostics={lint ? lint.diagnostics : schema ? schema.validation.diagnostics : null}
          onViewReady={(view) => {
            viewRef.current = view;
            onViewReady?.(view);
          }}
        />
      </div>
      {schema && (
        <SchemaPanel
          theme={theme}
          schemaText={schema.text}
          onSchemaChange={schema.onChange}
          validation={schema.validation}
          onJump={jumpTo}
          onGenerate={schema.onGenerate}
          onClose={onSchemaToggle}
        />
      )}
      {lint && <ProblemsPanel lint={lint} onJump={jumpTo} />}
    </div>
  );
}
