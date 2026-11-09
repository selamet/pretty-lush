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
import { outputFilename } from "../output/filename.js";
import { jsonToCsv } from "../convert/csv.js";

const VIEW_LABELS = { tree: "Tree", code: "Code", table: "Table" };

// Right pane of the "Format" view: formatted output (code / JSON tree /
// JSON table), the data-format Convert menu, export actions and the
// fullscreen toggle.
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
  fullscreen,
  onToggleFullscreen,
  conversions = [],
  onConvert,
  convertDisabled,
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
  const outLines = output ? output.split("\n").length : 0;
  const views = [
    jsonTreeData && "tree",
    "code",
    jsonTableData && "table",
  ].filter(Boolean);

  return (
    <div className={`pane ${fullscreen ? "is-fullscreen" : ""}`}>
      <div className="pane-head">
        <span className="title">Output</span>
        <div className="pane-actions">
          <span className="meta">{output ? `${outLines} lines` : "—"}</span>
          {(jsonTreeData || jsonTableData) && !error && (
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
          {tableCsv && !error && (
            <DownloadButton
              text={tableCsv}
              filename="table.csv"
              label="CSV"
              ariaLabel="Download table as CSV"
              mime="text/csv"
            />
          )}
          <ConvertMenu
            conversions={conversions}
            onConvert={onConvert}
            disabled={convertDisabled}
          />
          <ImageButton
            targetRef={captureRef}
            language={language.label}
            disabled={!output || !!error}
          />
          <DownloadButton text={output} filename={outputFilename(language)} />
          <CopyMarkdownButton text={output} lang={language.id} />
          <CopyButton text={output} />
          <FullscreenButton active={fullscreen} onToggle={onToggleFullscreen} />
        </div>
      </div>
      <div className="editor-host" ref={captureRef}>
        {error ? (
          <ErrorCard error={error} language={language.label} />
        ) : outputView === "tree" ? (
          <JsonTree key={output} data={jsonTreeData} onUsePath={onUseJsonPath} />
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
