import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import BrandMark from "./BrandMark.jsx";
import { BOOKMARKLET_LABEL, buildBookmarklet } from "../bookmarklet/index.js";

// About / "Get the bookmarklet" dialog: a draggable "Format in Pretty Lush"
// bookmark, install steps per browser and a Copy code fallback for mobile.
// Closes on Escape or backdrop click.
export default function BookmarkletDialog({ open, onClose, onNotify }) {
  const linkRef = useRef(null);
  const [copied, setCopied] = useState(false);
  // Built from the running app's origin, so preview / local builds hand out
  // a bookmarklet that opens themselves.
  const href = useMemo(() => buildBookmarklet(window.location.origin), []);

  // React warns about (and future versions block) `javascript:` URLs in the
  // `href` prop, as an XSS guard. This one is our own constant code, so it
  // is set on the DOM node directly — the attribute is what the browser
  // copies into the bookmark when the link is dragged.
  useLayoutEffect(() => {
    if (open && linkRef.current) linkRef.current.setAttribute("href", href);
  }, [open, href]);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => linkRef.current?.focus(), 0);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  if (!open) return null;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
    } catch {
      onNotify({ kind: "err", message: "Could not copy the bookmarklet code" });
    }
  }

  return (
    <div className="dialog-overlay" onMouseDown={onClose}>
      <div
        className="dialog bookmarklet-dialog"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bookmarklet-title"
      >
        <div className="dialog-head">
          <h2 id="bookmarklet-title" className="dialog-title bookmarklet-title">
            <BrandMark size={20} />
            Format code from any page
          </h2>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="dialog-body">
          <p className="bookmarklet-lead">
            Pretty Lush is an in-browser code formatter: everything runs locally and
            nothing is uploaded. Add the bookmarklet, select code on any page and click
            it — the snippet opens here in a new tab, with its language detected and
            already formatted.
          </p>

          <div className="bookmarklet-drag">
            {/* href is set in the layout effect above, not as a prop. */}
            <a
              ref={linkRef}
              className="bookmarklet-pill"
              draggable="true"
              title="Drag me to your bookmarks bar"
              onClick={(e) => {
                // Clicking it here would just send this page to itself.
                e.preventDefault();
                onNotify({ kind: "ok", message: "Drag the button to your bookmarks bar to install it" });
              }}
            >
              <BrandMark size={16} />
              {BOOKMARKLET_LABEL}
            </a>
            <span className="bookmarklet-drag-hint" aria-hidden="true">
              ← drag to your bookmarks bar
            </span>
          </div>

          <ul className="bookmarklet-steps">
            <li>
              <b>Chrome / Edge</b> — show the bookmarks bar (<kbd>⌘⇧B</kbd> /{" "}
              <kbd>Ctrl+Shift+B</kbd>), then drag the button onto it.
            </li>
            <li>
              <b>Firefox</b> — View → Toolbars → Bookmarks Toolbar, then drag the button
              onto it.
            </li>
            <li>
              <b>Safari</b> — View → Show Favorites Bar (<kbd>⌘⇧B</kbd>), then drag the
              button onto it.
            </li>
            <li>
              <b>Mobile</b> — copy the code, bookmark any page, edit that bookmark and
              paste the code as its URL.
            </li>
          </ul>

          <p className="dialog-hint">
            Nothing selected? It sends the focused text field, or the page's only code
            block. Selections over 1,000,000 characters are cut. The snippet travels in
            the URL fragment, which never reaches a server.
          </p>
        </div>

        <div className="dialog-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn-primary" onClick={copyCode}>
            {copied ? "Copied" : "Copy code"}
          </button>
        </div>
      </div>
    </div>
  );
}
