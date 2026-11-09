import { useMemo, useRef } from "react";
import CodeEditor from "./CodeEditor.jsx";
import CopyMarkdownButton from "./CopyMarkdownButton.jsx";
import JsonTree from "./JsonTree.jsx";
import JsonTable from "./JsonTable.jsx";
import ErrorCard from "./ErrorCard.jsx";
import ImageButton from "./ImageButton.jsx";
import DownloadButton from "./DownloadButton.jsx";
import CopyButton from "./CopyButton.jsx";
import FullscreenButton from "./FullscreenButton.jsx";
import ConvertMenu from "./ConvertMenu.jsx";
import TypegenBar from "./TypegenBar.jsx";
import { outputFilename } from "../output/filename.js";
import { jsonToCsv } from "../convert/csv.js";
import { getTypegenTarget } from "../codegen/index.js";

const VIEW_LABELS = { tree: "Tree", code: "Code", table: "Table" };

// Right pane of the "Format" view: formatted output (code / JSON tree /
// JSON table), the data-format Convert menu, "Generate types" (JSON only),
// export actions and the fullscreen toggle.
//
// While `typegen` is set ({ target, rootName, code, error }) the pane shows
// the generated code instead of the formatted output; copy / download /
// image act on it.
export default function OutputPane({
  language,
  theme,
  output,
  error,
  outputView,
  jsonTreeData,
  jsonTableData,
  onJsonViewChange,
  onUseJsonPath,
  jsonTreeFilter = null,
  onNotify,
  treeSearchRequested = false,
  onTreeSearchFocused,
  fullscreen,
  onToggleFullscreen,
  conversions = [],
  onConvert,
  convertDisabled,
  typegen = null,
  typegenAvailable = false,
  onTypegenToggle,
  onTypegenChange,
}) {
  const captureRef = useRef(null);
  const tableCsv = useMemo(() => {
    if (outputView !== "table" || !jsonTableData) return "";
    try {
      return jsonToCsv(jsonTableData.rows);
    } catch {
      return "";
    }
  }, [outputView, jsonTableData]);
  const typegenTarget = typegen ? getTypegenTarget(typegen.target) : null;
  const shownText = typegen ? typegen.code : output;
  const shownError = typegen ? typegen.error : error;
  const shownLang = typegen ? typegenTarget.lang : language.id;
  const shownLabel = typegen ? typegenTarget.label : language.label;
  const outLines = shownText ? shownText.split("\n").length : 0;
  const views = [
    jsonTreeData && "tree",
    "code",
    jsonTableData && "table",
  ].filter(Boolean);

  return (
    <div className={`pane ${fullscreen ? "is-fullscreen" : ""}`}>
      <div className="pane-head">
        <span className="title">{typegen ? "Types" : "Output"}</span>
        <div className="pane-actions">
          <span className="meta">{shownText ? `${outLines} lines` : "—"}</span>
          {!typegen && (jsonTreeData || jsonTableData) && !error && (
            <div className="view-toggle small" role="tablist" aria-label="Output view">
              {views.map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={outputView === v}
                  className={outputView === v ? "on" : ""}
                  onClick={() => onJsonViewChange(v)}
                >
                  {VIEW_LABELS[v]}
                </button>
              ))}
            </div>
          )}
          {!typegen && tableCsv && !error && (
            <DownloadButton
              text={tableCsv}
              filename="table.csv"
              label="CSV"
              ariaLabel="Download table as CSV"
              mime="text/csv"
            />
          )}
          {!typegen && (
            <ConvertMenu
              conversions={conversions}
              onConvert={onConvert}
              disabled={convertDisabled}
            />
          )}
          {typegenAvailable && (
            <button
              type="button"
              className={`copy-btn types-btn ${typegen ? "is-on" : ""}`}
              aria-pressed={!!typegen}
              aria-label="Generate types from JSON"
              title={typegen ? "Back to formatted output" : "Generate TypeScript / Zod / Pydantic types"}
              onClick={onTypegenToggle}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1" />
                <path d="M16 21h1a2 2 0 0 0 2-2v-5a2 2 0 0 1 2-2 2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1" />
              </svg>
              <span className="types-btn-text">Types</span>
            </button>
          )}
          <ImageButton
            targetRef={captureRef}
            language={shownLabel}
            disabled={!shownText || !!shownError}
          />
          <DownloadButton
            text={shownText}
            filename={typegen ? typegenTarget.filename : outputFilename(language)}
          />
          <CopyMarkdownButton text={shownText} lang={shownLang} />
          <CopyButton text={shownText} />
          <FullscreenButton active={fullscreen} onToggle={onToggleFullscreen} />
        </div>
      </div>
      {typegen && (
        <TypegenBar
          target={typegen.target}
          rootName={typegen.rootName}
          onChange={onTypegenChange}
          onClose={onTypegenToggle}
        />
      )}
      <div className="editor-host" ref={captureRef}>
        {typegen ? (
          typegen.error ? (
            <ErrorCard error={typegen.error} language="JSON" />
          ) : (
            <CodeEditor
              theme={theme}
              value={typegen.code}
              language={typegenTarget.lang}
              readOnly
            />
          )
        ) : error ? (
          <ErrorCard error={error} language={language.label} />
        ) : outputView === "tree" ? (
          <JsonTree
            key={output}
            data={jsonTreeData}
            onUsePath={onUseJsonPath}
            onNotify={onNotify}
            filter={jsonTreeFilter}
            focusSearch={treeSearchRequested}
            onSearchFocused={onTreeSearchFocused}
          />
        ) : outputView === "table" ? (
          <JsonTable rows={jsonTableData.rows} keys={jsonTableData.keys} />
        ) : (
          <CodeEditor
            theme={theme}
            value={output}
            language={language.id}
            readOnly
            placeholder="Press Format (⌘⏎) to format the input."
          />
        )}
      </div>
    </div>
  );
}
