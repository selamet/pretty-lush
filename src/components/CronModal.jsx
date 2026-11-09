import { useEffect, useId, useMemo, useRef, useState } from "react";
import CopyButton from "./CopyButton.jsx";
import { CRON_PRESETS, explainCron, formatRelative } from "../cron/index.js";

const RUN_COUNT = 5;

function localZoneName() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";
  } catch {
    return "Local";
  }
}

function runFormatter(utc, withSeconds) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
    hourCycle: "h23",
    ...(utc ? { timeZone: "UTC" } : {}),
  });
}

// "Explain cron expression" modal: an expression field (prefilled from the
// selection / cursor line / input, see pickCronExpression), a plain-English
// description, the next 5 runs in local time or UTC, a per-field breakdown
// and preset chips. Everything updates as you type.
//
// `result` is `{ expression }` from the "Explain cron expression" tool in
// src/commands/text-tools.js.
export default function CronModal({ result, onClose }) {
  const [expression, setExpression] = useState(result?.expression ?? "");
  const [utc, setUtc] = useState(false);
  const inputRef = useRef(null);
  const ids = useId();
  const zone = useMemo(localZoneName, []);

  useEffect(() => {
    if (!result) return;
    setExpression(result.expression ?? "");
  }, [result]);

  useEffect(() => {
    if (!result) return;
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    inputRef.current?.select();
    return () => window.removeEventListener("keydown", onKey);
  }, [result, onClose]);

  // `now` is taken when the expression or zone changes, so the list is
  // stable while the modal is open.
  const explained = useMemo(
    () => ({ now: Date.now(), ...explainCron(expression, { count: RUN_COUNT, utc }) }),
    [expression, utc]
  );

  if (!result) return null;

  const fmt = explained.ok ? runFormatter(utc, explained.hasSeconds) : null;
  const errorId = `${ids}-error`;
  const descId = `${ids}-desc`;

  return (
    <div className="dialog-overlay" onMouseDown={onClose}>
      <div
        className="dialog jwt-dialog cron-dialog"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cron-title"
      >
        <div className="dialog-head">
          <h2 id="cron-title" className="dialog-title">
            Cron
            {explained.ok && explained.macro && (
              <span className="hash-source">{explained.macro}</span>
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
          <div className="dialog-row">
            <label className="dialog-label" htmlFor={`${ids}-expr`}>
              Expression
            </label>
            <input
              ref={inputRef}
              id={`${ids}-expr`}
              className="dialog-input cron-input"
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              placeholder="*/5 * * * *"
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              aria-invalid={!explained.ok}
              aria-describedby={explained.ok ? descId : errorId}
            />
            <div className="cron-presets" role="group" aria-label="Common presets">
              {CRON_PRESETS.map((p) => (
                <button
                  key={p.expression}
                  type="button"
                  className={`cron-chip${p.expression === expression.trim() ? " on" : ""}`}
                  aria-pressed={p.expression === expression.trim()}
                  title={p.expression}
                  onClick={() => {
                    setExpression(p.expression);
                    inputRef.current?.focus();
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {!explained.ok ? (
            <div id={errorId} className="dialog-error" role="alert">
              {explained.error}
            </div>
          ) : (
            <>
              <div className="cron-summary" aria-live="polite">
                <p id={descId} className="cron-description">
                  {explained.description}
                </p>
                <CopyButton text={explained.description} label="Copy description" />
              </div>

              {explained.reboot ? (
                <p className="dialog-hint">
                  Runs once each time the cron daemon starts (usually at
                  boot) — there are no scheduled times.
                </p>
              ) : (
                <>
                  <div className="jwt-section">
                    <div className="jwt-section-head cron-runs-head">
                      <span className="jwt-section-label">Next {RUN_COUNT} runs</span>
                      <div className="seg-toggle" role="radiogroup" aria-label="Time zone">
                        {[
                          [false, zone],
                          [true, "UTC"],
                        ].map(([isUtc, label]) => (
                          <button
                            key={label}
                            type="button"
                            role="radio"
                            aria-checked={utc === isUtc}
                            className={utc === isUtc ? "on" : ""}
                            onClick={() => setUtc(isUtc)}
                          >
                            {isUtc ? "UTC" : "Local"}
                            {!isUtc && <span className="cron-zone">{label}</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                    {explained.never ? (
                      <div className="dialog-error" role="status">
                        Never runs — no date matches (for example February 30
                        or April 31).
                      </div>
                    ) : (
                      <ol className="cron-runs">
                        {explained.runs.map((d) => (
                          <li key={d.getTime()}>
                            <time dateTime={d.toISOString()}>{fmt.format(d)}</time>
                            <span className="cron-rel">{formatRelative(d, explained.now)}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>

                  <div className="jwt-section">
                    <span className="jwt-section-label">Fields</span>
                    <div className="cron-table-wrap">
                      <table className="cron-fields">
                        <thead>
                          <tr>
                            <th scope="col">Field</th>
                            <th scope="col">Value</th>
                            <th scope="col">Matches</th>
                            <th scope="col" className="cron-col-allowed">Allowed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {explained.fields.map((f) => (
                            <tr key={f.id}>
                              <th scope="row">{f.label}</th>
                              <td><code>{f.raw}</code></td>
                              <td>{f.summary}</td>
                              <td className="cron-col-allowed">{f.allowed}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
          <p className="dialog-hint">
            5 fields (minute hour day month weekday) or 6 with seconds first;
            @daily-style macros work too. When both day-of-month and day-of-week
            are set, a day matching either one runs.
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
