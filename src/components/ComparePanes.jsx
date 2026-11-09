import CodeEditor from "./CodeEditor.jsx";
import DiffView from "./DiffView.jsx";

// "Compare" view mode: two free-form editors (A, B) and their live diff.
export default function ComparePanes({
  language,
  theme,
  compareA,
  setCompareA,
  compareB,
  setCompareB,
}) {
  return (
    <>
      <div className="pane compare-a">
        <div className="pane-head">
          <span className="title">A</span>
          <div className="pane-actions">
            <span className="meta">
              {compareA ? compareA.split("\n").length : 0} lines
            </span>
            <button
              type="button"
              className="copy-btn"
              onClick={() => setCompareA("")}
              disabled={!compareA}
              title="Clear A"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="editor-host">
          <CodeEditor
            theme={theme}
            value={compareA}
            onChange={setCompareA}
            language={language.id}
            placeholder={`Paste version A (${language.label})…`}
          />
        </div>
      </div>
      <div className="pane compare-b">
        <div className="pane-head">
          <span className="title">B</span>
          <div className="pane-actions">
            <span className="meta">
              {compareB ? compareB.split("\n").length : 0} lines
            </span>
            <button
              type="button"
              className="copy-btn"
              onClick={() => setCompareB("")}
              disabled={!compareB}
              title="Clear B"
            >
              Clear
            </button>
            <button
              type="button"
              className="copy-btn"
              onClick={() => {
                const a = compareA;
                setCompareA(compareB);
                setCompareB(a);
              }}
              disabled={!compareA && !compareB}
              title="Swap A and B"
            >
              Swap
            </button>
          </div>
        </div>
        <div className="editor-host">
          <CodeEditor
            theme={theme}
            value={compareB}
            onChange={setCompareB}
            language={language.id}
            placeholder={`Paste version B (${language.label})…`}
          />
        </div>
      </div>
      <div className="pane compare-diff">
        <div className="pane-head">
          <span className="title">Diff — A ↔ B</span>
          <span className="meta">
            {compareA === compareB ? (compareA ? "identical" : "—") : "differs"}
          </span>
        </div>
        <div className="editor-host">
          {!compareA && !compareB ? (
            <div className="compare-empty">
              Paste two snippets above to see the diff.
            </div>
          ) : (
            <DiffView before={compareA} after={compareB} />
          )}
        </div>
      </div>
    </>
  );
}
