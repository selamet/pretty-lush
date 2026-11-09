import { getLanguage } from "../languages/groups.js";
import { RECENT_VISIBLE, formatRelativeTime } from "../state/history.js";

// "Recent" list in the sidebar; click an entry to restore its input.
export default function RecentHistory({ history, onRestore, onClear }) {
  if (history.length === 0) return null;
  return (
    <div className="side-recent">
      <div className="side-label side-label-with-action">
        <span>Recent</span>
        <button
          type="button"
          className="side-action"
          onClick={onClear}
          title="Clear history"
        >
          Clear
        </button>
      </div>
      {history.slice(0, RECENT_VISIBLE).map((h) => (
        <div
          key={h.id}
          className="history-row"
          onClick={() => onRestore(h)}
          title={h.snippet}
        >
          <span className="history-lang">{getLanguage(h.lang)?.ext || h.lang}</span>
          <span className="history-snippet">{h.snippet || "(empty)"}</span>
          <span className="history-time">{formatRelativeTime(h.ts)}</span>
        </div>
      ))}
    </div>
  );
}
