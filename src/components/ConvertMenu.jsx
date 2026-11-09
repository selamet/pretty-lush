import { useEffect, useRef, useState } from "react";
import { FORMAT_LABELS } from "../convert/index.js";

// Keep in sync with .convert-menu min-width in styles.css.
const MENU_WIDTH = 184;

// "Convert" dropdown in the output pane head: converts the current input to
// another data format and switches the editor language. Rendered only for
// data languages (JSON / YAML / TOML / CSV). Menu follows the WAI-ARIA menu
// button pattern: Enter/Space/↓ opens and focuses the first item, ↑/↓ move,
// Escape closes and returns focus to the button.
export default function ConvertMenu({ conversions, onConvert, disabled }) {
  const [open, setOpen] = useState(false);
  // Menu opens right-aligned to the button; on narrow screens where that
  // would push it off the left edge, it is left-aligned instead.
  const [alignLeft, setAlignLeft] = useState(false);
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const itemRefs = useRef([]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    itemRefs.current[0]?.focus();
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  if (conversions.length === 0) return null;

  function toggle() {
    if (!open) {
      const rect = buttonRef.current?.getBoundingClientRect();
      setAlignLeft(!!rect && rect.right < MENU_WIDTH + 8);
    }
    setOpen((v) => !v);
  }

  function close({ refocus = true } = {}) {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  }

  function onMenuKeyDown(e) {
    const items = itemRefs.current.filter(Boolean);
    const i = items.indexOf(document.activeElement);
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === "Tab") {
      close({ refocus: false });
    }
  }

  return (
    <div className="convert-wrap" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`copy-btn convert-btn ${open ? "is-open" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Convert input to another format"
        title="Convert input to another format"
        disabled={disabled}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            toggle();
          }
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
        <span className="convert-btn-text">Convert</span>
        <svg className="convert-caret" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div
          className={`convert-menu ${alignLeft ? "align-left" : ""}`}
          role="menu"
          aria-label="Convert to"
          onKeyDown={onMenuKeyDown}
        >
          <div className="convert-menu-label" aria-hidden="true">
            Convert {FORMAT_LABELS[conversions[0].from]} to
          </div>
          {conversions.map((c, i) => (
            <button
              key={c.id}
              ref={(el) => (itemRefs.current[i] = el)}
              type="button"
              role="menuitem"
              className="convert-item"
              onClick={() => {
                close();
                onConvert(c);
              }}
            >
              <span className="convert-item-to">{FORMAT_LABELS[c.to]}</span>
              <span className="convert-item-ext">.{c.to}</span>
            </button>
          ))}
          <div className="convert-menu-foot" aria-hidden="true">
            Previous input is kept in Recent
          </div>
        </div>
      )}
    </div>
  );
}
