import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function CommandPalette({ open, onClose, commands }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return commands;
    const tokens = q.split(/\s+/);
    return commands.filter((c) => {
      const hay = `${c.label} ${c.group || ""} ${c.keywords || ""}`.toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });
  }, [query, commands]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const row = listRef.current?.children?.[activeIndex];
    if (row) row.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function handleKey(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filtered[activeIndex];
      if (cmd) {
        cmd.run();
        onClose();
      }
    }
  }

  if (!open) return null;

  return createPortal(
    <div className="palette-overlay" onMouseDown={onClose}>
      <div
        className="palette"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={handleKey}
      >
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="Type a command or search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="palette-list" ref={listRef}>
          {filtered.length === 0 ? (
            <div className="palette-empty">No matches.</div>
          ) : (
            filtered.map((cmd, i) => (
              <div
                key={cmd.id}
                className={`palette-row ${i === activeIndex ? "active" : ""}`}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => {
                  cmd.run();
                  onClose();
                }}
              >
                <span className="palette-label">
                  {cmd.group && <span className="palette-group">{cmd.group}</span>}
                  <span>{cmd.label}</span>
                </span>
                {cmd.shortcut && (
                  <span className="palette-shortcut">{cmd.shortcut}</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
