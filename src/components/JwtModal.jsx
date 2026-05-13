import { useEffect } from "react";

// Modal that renders a decoded JWT (header / payload / signature plus
// timing metadata). Closes on Escape or backdrop click.
//
// `result` is the shape returned by text-utils/jwt.js#decodeJwt — a null
// result keeps the modal hidden.
export default function JwtModal({ result, onClose }) {
  useEffect(() => {
    if (!result) return;
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [result, onClose]);

  if (!result) return null;

  const { header, payload, signature, meta } = result;
  const fmt = (d) => (d ? `${d.toISOString()} (${d.toLocaleString()})` : "—");

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  }

  return (
    <div className="dialog-overlay" onMouseDown={onClose}>
      <div
        className="dialog jwt-dialog"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="jwt-title"
      >
        <div className="dialog-head">
          <h2 id="jwt-title" className="dialog-title">
            JWT decoded
            {meta.expired === true && (
              <span className="jwt-badge jwt-badge-warn">expired</span>
            )}
            {meta.expired === false && (
              <span className="jwt-badge jwt-badge-ok">valid window</span>
            )}
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
          <JwtSection
            label="Header"
            value={JSON.stringify(header, null, 2)}
            onCopy={() => copy(JSON.stringify(header, null, 2))}
          />
          <JwtSection
            label="Payload"
            value={JSON.stringify(payload, null, 2)}
            onCopy={() => copy(JSON.stringify(payload, null, 2))}
          />
          <div className="jwt-meta">
            <div>
              <span className="jwt-meta-key">Issued</span>
              <span>{fmt(meta.issuedAt)}</span>
            </div>
            <div>
              <span className="jwt-meta-key">Not before</span>
              <span>{fmt(meta.notBefore)}</span>
            </div>
            <div>
              <span className="jwt-meta-key">Expires</span>
              <span>{fmt(meta.expiresAt)}</span>
            </div>
            {meta.lifetimeSec != null && (
              <div>
                <span className="jwt-meta-key">Lifetime</span>
                <span>
                  {meta.lifetimeSec}s ({(meta.lifetimeSec / 60).toFixed(1)} min)
                </span>
              </div>
            )}
          </div>
          <JwtSection
            label="Signature"
            value={signature}
            mono
            onCopy={() => copy(signature)}
          />
          <p className="dialog-hint">
            Signature is not verified — pretty-lush has no key. Use a server
            or your auth library to validate.
          </p>
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function JwtSection({ label, value, mono, onCopy }) {
  return (
    <div className="jwt-section">
      <div className="jwt-section-head">
        <span className="jwt-section-label">{label}</span>
        <button
          type="button"
          className="copy-btn"
          onClick={onCopy}
          aria-label={`Copy ${label}`}
        >
          Copy
        </button>
      </div>
      <pre className={`jwt-section-body${mono ? " is-mono" : ""}`}>{value}</pre>
    </div>
  );
}
