import { useEffect, useId, useRef, useState } from "react";
import CodeEditor from "./CodeEditor.jsx";
import CopyButton from "./CopyButton.jsx";
import {
  MAX_MATCHES,
  REGEX_FLAGS,
  friendlyRegexError,
  parseRegexLiteral,
  toggleFlag,
} from "../regex/core.js";
import { regexHighlight, showRegexMatches } from "../regex/highlight.js";
import { CHEAT_SHEET } from "../regex/cheatsheet.js";

// Matches rendered in the results list; the editor still highlights all.
const LIST_LIMIT = 1000;
const TIMEOUT_MESSAGE = "Pattern took too long (possible catastrophic backtracking)";

const fmt = (n) => n.toLocaleString("en-US");

// Shows a value with visible whitespace-only / empty markers.
function Value({ value, clipped }) {
  if (value === null) return <span className="regex-val is-missing">undefined</span>;
  if (value === "") return <span className="regex-val is-missing">empty</span>;
  return (
    <span className="regex-val">
      {value}
      {clipped && <span className="regex-clip">…</span>}
    </span>
  );
}

function CheatSheet({ onInsert }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="regex-cheats-wrap" ref={wrapRef}>
      <button
        type="button"
        className="copy-btn"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        title="Regex quick reference"
      >
        Cheat sheet
      </button>
      {open && (
        <div className="popover regex-cheats" role="dialog" aria-label="Regex quick reference">
          {CHEAT_SHEET.map((section) => (
            <section key={section.title} className="regex-cheats-section">
              <h3>{section.title}</h3>
              <ul>
                {section.items.map(([token, desc, insert]) => (
                  <li key={token}>
                    <button
                      type="button"
                      onClick={() => onInsert(section.target, insert ?? token)}
                      title={`Insert ${insert ?? token}`}
                    >
                      <code>{token}</code>
                      <span>{desc}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

// "Regex" view mode: pattern + flags + test text (with match / group
// highlights), the list of matches and a live replace preview. Matching runs
// in a worker with a timeout (hooks/useRegexTester.js).
export default function RegexPanes({ theme, regex, seedAvailable }) {
  const {
    pattern,
    flags,
    replacement,
    setPattern,
    setFlags,
    setReplacement,
    update,
    text,
    setText,
    reseed,
    result,
    running,
  } = regex;
  const viewRef = useRef(null);
  const patternRef = useRef(null);
  const replacementRef = useRef(null);
  const errorId = useId();

  // The list, counts and replace preview show the latest result even while
  // a newer run is pending (no flicker while typing); highlights are only
  // repainted from a result computed for the exact current text; in between
  // the previous marks are mapped through the edits.
  const current = result?.status === "ok" ? result : null;
  const matches = current ? current.matches : [];

  useEffect(() => {
    if (!result) return;
    if (result.status !== "ok") showRegexMatches(viewRef.current, []);
    else if (result.forText === text) showRegexMatches(viewRef.current, result.matches);
  }, [result, text]);

  function handlePatternPaste(e) {
    const pasted = e.clipboardData?.getData("text") ?? "";
    const literal = parseRegexLiteral(pasted);
    const input = e.currentTarget;
    const replacesAll =
      !input.value || (input.selectionStart === 0 && input.selectionEnd === input.value.length);
    if (!literal || !replacesAll) return;
    e.preventDefault();
    update({ pattern: literal.pattern, flags: literal.flags });
  }

  function insertToken(target, token) {
    const ref = target === "replacement" ? replacementRef : patternRef;
    const value = target === "replacement" ? replacement : pattern;
    const set = target === "replacement" ? setReplacement : setPattern;
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    set(value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      // Put the caret inside "()"-style tokens.
      const inner = /^\(.*\)$/.test(token) ? token.length - 1 : token.length;
      el.setSelectionRange(start + inner, start + inner);
    });
  }

  function selectMatch(m) {
    const view = viewRef.current;
    if (!view || view.destroyed) return;
    const len = view.state.doc.length;
    view.dispatch({
      selection: { anchor: Math.min(m.start, len), head: Math.min(m.end, len) },
      scrollIntoView: true,
    });
    view.focus();
  }

  let message = null;
  if (result?.status === "error") {
    message = { kind: "error", text: friendlyRegexError(result.error) };
  } else if (result?.status === "timeout") {
    message = { kind: "error", text: TIMEOUT_MESSAGE };
  } else if (current?.truncated) {
    message = {
      kind: "notice",
      text: `Stopped after ${fmt(MAX_MATCHES)} matches — only those are highlighted and listed.`,
    };
  }
  const invalid = result?.status === "error" || result?.status === "timeout";

  let meta = "—";
  if (running && !current) meta = "running…";
  else if (current) {
    const n = current.matches.length;
    meta = `${current.truncated ? "≥ " : ""}${fmt(n)} match${n === 1 ? "" : "es"}`;
    if (typeof current.elapsedMs === "number") meta += ` · ${Math.round(current.elapsedMs)} ms`;
  } else if (invalid) meta = "no result";

  const globalOff = !!current && !flags.includes("g");
  const showGroupRanges = flags.includes("d");
  const replaced = current ? current.replaced : null;

  return (
    <>
      <div className="pane regex-main">
        <div className="pane-head">
          <span className="title">Regex</span>
          <div className="pane-actions">
            <span className="meta" aria-live="polite">
              {meta}
            </span>
            <button
              type="button"
              className="copy-btn"
              onClick={reseed}
              disabled={!seedAvailable}
              title="Replace the test text with the current input"
            >
              Use input
            </button>
            <CheatSheet onInsert={insertToken} />
          </div>
        </div>
        <div className="regex-bar">
          <div className={`regex-field ${invalid ? "is-invalid" : ""}`}>
            <span className="regex-delim" aria-hidden="true">/</span>
            <input
              ref={patternRef}
              className="regex-input"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              onPaste={handlePatternPaste}
              placeholder="pattern — or paste /pattern/flags"
              aria-label="Regular expression pattern"
              aria-invalid={invalid}
              aria-describedby={message ? errorId : undefined}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
            />
            <span className="regex-delim" aria-hidden="true">
              /<span className="regex-flags-text">{flags}</span>
            </span>
          </div>
          <div className="mini-seg regex-flags" role="group" aria-label="Flags">
            {REGEX_FLAGS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={flags.includes(f.id)}
                className={flags.includes(f.id) ? "on" : ""}
                onClick={() => setFlags(toggleFlag(flags, f.id))}
                title={f.title}
                aria-label={`${f.id} — ${f.label}`}
              >
                {f.id}
              </button>
            ))}
          </div>
          {message && (
            <div
              id={errorId}
              className={`regex-message is-${message.kind}`}
              role={message.kind === "error" ? "alert" : "status"}
            >
              {message.text}
            </div>
          )}
        </div>
        <div className="editor-host">
          <CodeEditor
            theme={theme}
            value={text}
            onChange={setText}
            language="text"
            placeholder="Test text — matches are highlighted as you type…"
            extraExtensions={regexHighlight}
            onViewReady={(view) => {
              viewRef.current = view;
              if (current && current.forText === text) showRegexMatches(view, matches);
            }}
          />
        </div>
      </div>

      <div className="pane regex-results">
        <div className="pane-head">
          <span className="title">Matches</span>
          {globalOff && <span className="meta">first match only (g off)</span>}
        </div>
        <div className="regex-list-host">
          {!current ? (
            <div className="compare-empty">
              {!pattern
                ? "Type a pattern to see its matches."
                : invalid
                  ? "Fix the pattern to see matches."
                  : "Matching…"}
            </div>
          ) : matches.length === 0 ? (
            <div className="compare-empty">No matches.</div>
          ) : (
            <>
              <ol className="regex-list">
                {matches.slice(0, LIST_LIMIT).map((m) => (
                  <li key={m.index} className={`regex-item v${m.index % 2}`}>
                    <button
                      type="button"
                      className="regex-item-head"
                      onClick={() => selectMatch(m)}
                      title="Select this match in the test text"
                    >
                      <span className="regex-idx">#{m.index + 1}</span>
                      <span className="regex-range">
                        {m.start}–{m.end}
                      </span>
                      <Value value={m.value} clipped={m.clipped} />
                    </button>
                    {m.groups.length > 0 && (
                      <ul className="regex-groups">
                        {m.groups.map((g) => (
                          <li key={g.n}>
                            <span className={`regex-group-label g${(g.n - 1) % 4}`}>
                              {g.n}
                              {g.name && <span className="regex-group-name">{g.name}</span>}
                            </span>
                            {showGroupRanges && (
                              <span className="regex-range">
                                {g.start == null ? "—" : `${g.start}–${g.end}`}
                              </span>
                            )}
                            <Value value={g.value} clipped={g.clipped} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
              {matches.length > LIST_LIMIT && (
                <div className="regex-list-more">
                  Listing the first {fmt(LIST_LIMIT)} of {fmt(matches.length)} matches.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="pane regex-replace">
        <div className="pane-head">
          <span className="title">Replace</span>
          <div className="pane-actions">
            <CopyButton text={replaced ?? ""} label="Copy replaced text" />
          </div>
        </div>
        <div className="regex-bar">
          <div className="regex-field">
            <input
              ref={replacementRef}
              className="regex-input"
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              placeholder="Replacement — $1, $<name>, $& …"
              aria-label="Replacement"
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
            />
          </div>
        </div>
        <div className="editor-host">
          <CodeEditor
            theme={theme}
            value={replaced ?? ""}
            language="text"
            readOnly
            placeholder="The replaced text shows up here."
          />
        </div>
      </div>
    </>
  );
}
