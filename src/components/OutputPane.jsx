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
import CurlBar from "./CurlBar.jsx";
import { outputFilename } from "../output/filename.js";
import { jsonToCsv } from "../convert/csv.js";
import { getTypegenTarget } from "../codegen/index.js";
import { getCurlTarget } from "../curl/index.js";

const VIEW_LABELS = { tree: "Tree", code: "Code", table: "Table" };

// Right pane of the "Format" view: formatted output (code / JSON tree /
// JSON table), the data-format Convert menu, "Generate types" (JSON only),
// "cURL → code" (when the input is a cURL command),
// export actions and the fullscreen toggle.
//
// While `typegen` is set ({ target, rootName, code, error }) the pane shows
// the generated code instead of the formatted output; copy / download /
// image act on it. `curl` ({ target, code, warnings, error }) does the same
// for code converted from a cURL command in the input.
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
  curl = null,
  curlAvailable = false,
  onCurlToggle,
  onCurlChange,
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
  // Generated code shown instead of the formatted output, if any.
  const gen = typegen
    ? { ...typegen, title: "Types", target: getTypegenTarget(typegen.target), source: "JSON" }
    : curl
      ? { ...curl, title: "Code", target: getCurlTarget(curl.target), source: "cURL" }
      : null;
  const shownText = gen ? gen.code : output;
  const shownError = gen ? gen.error : error;
  const shownLang = gen ? gen.target.lang : language.id;
  const shownLabel = gen ? gen.target.label : language.label;
  const outLines = shownText ? shownText.split("\n").length : 0;
  const views = [
    jsonTreeData && "tree",
    "code",
    jsonTableData && "table",
  ].filter(Boolean);

  return (
    <div className={`pane ${fullscreen ? "is-fullscreen" : ""}`}>
      <div className="pane-head">
        <span className="title">{gen ? gen.title : "Output"}</span>
        <div className="pane-actions">
          <span className="meta">{shownText ? `${outLines} lines` : "—"}</span>
          {!gen && (jsonTreeData || jsonTableData) && !error && (
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
          {!gen && tableCsv && !error && (
            <DownloadButton
              text={tableCsv}
              filename="table.csv"
              label="CSV"
              ariaLabel="Download table as CSV"
              mime="text/csv"
            />
          )}
          {!gen && (
            <ConvertMenu
              conversions={conversions}
              onConvert={onConvert}
              disabled={convertDisabled}
            />
          )}
          {curlAvailable && !typegen && (
            <button
              type="button"
              className={`copy-btn types-btn curl-btn ${curl ? "is-on" : ""}`}
              aria-pressed={!!curl}
              aria-label="Convert cURL command to code"
              title={curl ? "Back to formatted output" : "Convert cURL to fetch / axios / Python requests"}
              onClick={onCurlToggle}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              <span className="types-btn-text">Code</span>
            </button>
          )}
          {typegenAvailable && !curl && (
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
            filename={gen ? gen.target.filename : outputFilename(language)}
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
      {curl && (
        <CurlBar
          target={curl.target}
          warnings={curl.error ? [] : curl.warnings}
          onChange={onCurlChange}
          onClose={onCurlToggle}
        />
      )}
      <div className="editor-host" ref={captureRef}>
        {gen ? (
          gen.error ? (
            <ErrorCard error={gen.error} language={gen.source} />
          ) : (
            <CodeEditor
              theme={theme}
              value={gen.code}
              language={gen.target.lang}
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
