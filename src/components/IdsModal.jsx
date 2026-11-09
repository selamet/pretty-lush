import { useEffect, useRef, useState } from "react";
import CopyButton from "./CopyButton.jsx";
import { ID_KINDS, MAX_ID_COUNT, clampIdCount, generateIds } from "../text-utils/ids.js";

// "Generate N UUIDs…" modal: pick UUID v4 / UUID v7 / ULID and a count,
// preview the list, then copy it or insert it into the input (one per
// line, at the cursor — see insertIntoInput in App.jsx).
export default function IdsModal({ result, onClose, onInsert }) {
  const [kind, setKind] = useState("uuidv4");
  const [countText, setCountText] = useState("10");
  const [ids, setIds] = useState([]);
  const countRef = useRef(null);
  const count = clampIdCount(countText);

  useEffect(() => {
    if (!result) return;
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    countRef.current?.select();
    return () => window.removeEventListener("keydown", onKey);
  }, [result, onClose]);

  useEffect(() => {
    if (result) setIds(generateIds(kind, count));
  }, [result, kind, count]);

  if (!result) return null;

  const text = ids.join("\n");
  const kindLabel = ID_KINDS.find((k) => k.id === kind).label;

  function insert() {
    onInsert(text, `${ids.length} × ${kindLabel}`);
    onClose();
  }

  return (
    <div className="dialog-overlay" onMouseDown={onClose}>
      <div
        className="dialog jwt-dialog"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ids-title"
      >
        <div className="dialog-head">
          <h2 id="ids-title" className="dialog-title">
            Generate IDs
          </h2>
          <button
            type="button"
            className="dialog-close"
            onClick={onClose}
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <form
          className="dialog-body"
          onSubmit={(e) => {
            e.preventDefault();
            insert();
          }}
        >
          <div className="ids-controls">
            <div className="seg-toggle" role="radiogroup" aria-label="ID type">
              {ID_KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  role="radio"
                  aria-checked={kind === k.id}
                  className={kind === k.id ? "on" : ""}
                  onClick={() => setKind(k.id)}
                >
                  {k.label}
                </button>
              ))}
            </div>
            <label className="ids-count">
              <span className="dialog-label">Count</span>
              <input
                ref={countRef}
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_ID_COUNT}
                className="dialog-input"
                value={countText}
                onChange={(e) => setCountText(e.target.value)}
              />
            </label>
          </div>
          <div className="jwt-section">
            <div className="jwt-section-head">
              <span className="jwt-section-label">
                {ids.length} × {kindLabel}
              </span>
              <span className="ids-actions">
                <button
                  type="button"
                  className="copy-btn"
                  onClick={() => setIds(generateIds(kind, count))}
                  aria-label="Regenerate"
                >
                  Regenerate
                </button>
                <CopyButton text={text} label="Copy all IDs" />
              </span>
            </div>
            <pre className="jwt-section-body ids-list">{text}</pre>
          </div>
          <p className="dialog-hint">
            {kind === "uuidv4"
              ? "Random (122 bits). Use when IDs shouldn't reveal creation time."
              : "Time-ordered: sorts by creation time, even within the same millisecond — good as database keys."}{" "}
            Up to {MAX_ID_COUNT.toLocaleString()} at a time.
          </p>
        </form>
        <div className="dialog-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={insert}>
            Insert into input
          </button>
        </div>
      </div>
    </div>
  );
}
