import DiffView from "./DiffView.jsx";
import ErrorCard from "./ErrorCard.jsx";
import DownloadButton from "./DownloadButton.jsx";
import CopyButton from "./CopyButton.jsx";
import { outputFilename } from "../output/filename.js";

// "Diff" view mode: input ↔ formatted output.
export default function DiffPane({ language, input, output, error }) {
  return (
    <div className="pane diff-pane">
      <div className="pane-head">
        <span className="title">Diff — input ↔ output</span>
        <div className="pane-actions">
          <DownloadButton text={output} filename={outputFilename(language)} />
          <CopyButton text={output} />
        </div>
      </div>
      <div className="editor-host">
        {error ? (
          <ErrorCard error={error} language={language.label} />
        ) : (
          <DiffView before={input} after={output} />
        )}
      </div>
    </div>
  );
}
