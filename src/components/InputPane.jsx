import CodeEditor from "./CodeEditor.jsx";

// Left pane of the "Format" view: the input editor, plus the JSONPath bar
// when the language is JSON.
export default function InputPane({
  language,
  theme,
  input,
  onInputChange,
  error,
  onPaste,
  jsonPath,
  onJsonPathChange,
  onFormat,
}) {
  const inLines = input.split("\n").length;
  return (
    <div className="pane">
      <div className="pane-head">
        <span className="title">Input</span>
        <span className="meta">
          {inLines} {inLines === 1 ? "line" : "lines"}
        </span>
      </div>
      {language.id === "json" && (
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
      <div className="editor-host" onPaste={onPaste}>
        <CodeEditor
          theme={theme}
          value={input}
          onChange={onInputChange}
          language={language.id}
          placeholder={`Paste ${language.label} here…`}
          errorLine={error?.line ?? null}
        />
      </div>
    </div>
  );
}
