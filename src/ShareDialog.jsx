import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const TTL_OPTIONS = [
  { label: "1 hour", seconds: 60 * 60 },
  { label: "1 day", seconds: 60 * 60 * 24 },
  { label: "7 days", seconds: 60 * 60 * 24 * 7 },
  { label: "30 days", seconds: 60 * 60 * 24 * 30 },
];

export default function ShareDialog({ open, onClose, onCreate, busy, error }) {
  const [mode, setMode] = useState("server");
  const [password, setPassword] = useState("");
  const [ttl, setTtl] = useState(TTL_OPTIONS[2].seconds);
  const firstFieldRef = useRef(null);

  useEffect(() => {
    if (open) {
      setPassword("");
      setMode("server");
      setTtl(TTL_OPTIONS[2].seconds);
      setTimeout(() => firstFieldRef.current?.focus(), 0);
    }
  }, [open]);

  if (!open) return null;

  function handleKey(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  }

  function submit() {
    if (busy) return;
    onCreate({ mode, password: password || null, ttl });
  }

  return createPortal(
    <div className="dialog-overlay" onMouseDown={onClose}>
      <div
        className="dialog"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={handleKey}
        role="dialog"
        aria-labelledby="share-dialog-title"
      >
        <div className="dialog-head">
          <h2 id="share-dialog-title" className="dialog-title">
            Share snippet
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

        <div className="dialog-body">
          <div className="dialog-row">
            <label className="dialog-label">Where to store</label>
            <div className="seg-toggle" role="tablist">
              <button
                type="button"
                className={mode === "server" ? "on" : ""}
                onClick={() => setMode("server")}
              >
                Encrypted link
              </button>
              <button
                type="button"
                className={mode === "url" ? "on" : ""}
                onClick={() => setMode("url")}
              >
                URL only
              </button>
            </div>
            <p className="dialog-hint">
              {mode === "server"
                ? "Content is encrypted in your browser, stored on the server, and expires automatically. The decryption key lives in the URL fragment — the server never sees it."
                : "The whole snippet is base64-encoded into the URL. No server roundtrip, but the link grows with the snippet."}
            </p>
          </div>

          {mode === "server" && (
            <>
              <div className="dialog-row">
                <label className="dialog-label" htmlFor="share-password">
                  Password <span className="dialog-optional">(optional)</span>
                </label>
                <input
                  id="share-password"
                  ref={firstFieldRef}
                  className="dialog-input"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave empty for link-only access"
                />
                <p className="dialog-hint">
                  Adds a second key derived from this password. A leaked URL
                  alone is not enough to decrypt.
                </p>
              </div>

              <div className="dialog-row">
                <label className="dialog-label" htmlFor="share-ttl">
                  Expires after
                </label>
                <select
                  id="share-ttl"
                  className="dialog-input"
                  value={ttl}
                  onChange={(e) => setTtl(Number(e.target.value))}
                >
                  {TTL_OPTIONS.map((o) => (
                    <option key={o.seconds} value={o.seconds}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {error && (
            <div className="dialog-error">
              <div>{typeof error === "string" ? error : error.message}</div>
              {typeof error === "object" && error.suggestUrl && mode === "server" && (
                <button
                  type="button"
                  className="dialog-error-action"
                  onClick={() => setMode("url")}
                >
                  Use URL-only share instead
                </button>
              )}
            </div>
          )}
        </div>

        <div className="dialog-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={submit}
            disabled={busy}
          >
            {busy ? "Creating…" : "Create link"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function PasswordPrompt({ open, onSubmit, onCancel, busy, error }) {
  const [password, setPassword] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setPassword("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  if (!open) return null;

  function handleKey(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (password && !busy) onSubmit(password);
    }
  }

  return createPortal(
    <div className="dialog-overlay" onMouseDown={onCancel}>
      <div
        className="dialog dialog-narrow"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={handleKey}
        role="dialog"
        aria-labelledby="pw-dialog-title"
      >
        <div className="dialog-head">
          <h2 id="pw-dialog-title" className="dialog-title">
            Password required
          </h2>
        </div>
        <div className="dialog-body">
          <p className="dialog-hint">
            This shared snippet is protected. Enter the password to decrypt.
          </p>
          <input
            ref={inputRef}
            className="dialog-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />
          {error && <div className="dialog-error">{error}</div>}
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !password}
            onClick={() => onSubmit(password)}
          >
            {busy ? "Decrypting…" : "Unlock"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
