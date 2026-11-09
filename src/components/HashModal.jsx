import { useEffect, useRef, useState } from "react";
import CopyButton from "./CopyButton.jsx";
import { HASH_ALGORITHMS, digestAll, encodeDigest } from "../text-utils/hash.js";

// Modal listing MD5 / SHA-1 / SHA-256 / SHA-384 / SHA-512 of the input (or
// of the input editor's selection), each with a copy button, plus a
// hex / base64 switch. Hashing is async (Web Crypto) and runs once per
// opened text; the encoding switch only re-encodes the digests.
//
// `result` is `{ text, source: "input"|"selection" }` from the "Hash input…"
// tool in src/commands/text-tools.js.
export default function HashModal({ result, onClose }) {
  const [digests, setDigests] = useState(null);
  const [error, setError] = useState(null);
  const [encoding, setEncoding] = useState("hex");
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!result) return;
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [result, onClose]);

  useEffect(() => {
    if (!result) return;
    let cancelled = false;
    setDigests(null);
    setError(null);
    digestAll(result.text).then(
      (d) => !cancelled && setDigests(d),
      (e) => !cancelled && setError(e.message)
    );
    return () => {
      cancelled = true;
    };
  }, [result]);

  if (!result) return null;

  const bytes = new TextEncoder().encode(result.text).length;
  const what = result.source === "selection" ? "Selection" : "Input";

  return (
    <div className="dialog-overlay" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="dialog jwt-dialog hash-dialog"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hash-title"
      >
        <div className="dialog-head">
          <h2 id="hash-title" className="dialog-title">
            Hash
            <span className="hash-source">
              {what} · {bytes.toLocaleString()} {bytes === 1 ? "byte" : "bytes"} UTF-8
            </span>
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
          <div className="seg-toggle" role="radiogroup" aria-label="Output encoding">
            {[
              ["hex", "Hex"],
              ["base64", "Base64"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={encoding === id}
                className={encoding === id ? "on" : ""}
                onClick={() => setEncoding(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {error ? (
            <div className="dialog-error" role="alert">
              {error}
            </div>
          ) : (
            <div className="hash-list" aria-busy={!digests}>
              {HASH_ALGORITHMS.map((a) => {
                const value = digests ? encodeDigest(digests[a.id], encoding) : "";
                return (
                  <div className="hash-row" key={a.id}>
                    <div className="jwt-section-head">
                      <span className="jwt-section-label">
                        {a.label}
                        {a.insecure && (
                          <span
                            className="hash-insecure"
                            title="Broken for collision resistance — use for checksums only, not for security"
                          >
                            insecure
                          </span>
                        )}
                      </span>
                      <CopyButton text={value} label={`Copy ${a.label}`} />
                    </div>
                    <code className="hash-value">{value || "…"}</code>
                  </div>
                );
              })}
            </div>
          )}
          <p className="dialog-hint">
            Computed in your browser — nothing is uploaded. MD5 and SHA-1 are
            fine for checksums and cache keys, not for signatures or passwords.
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
