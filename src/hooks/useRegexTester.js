import { useCallback, useEffect, useRef, useState } from "react";
import { STORAGE_KEYS, getStorage } from "../state/storage.js";
import { loadRegexState } from "../state/regex.js";
import { usePersistentState } from "./usePersistentState.js";
import { MAX_MATCHES, compileRegex } from "../regex/core.js";
import { createRegexRunner } from "../regex/runner.js";

// Delay after the last keystroke before re-running the pattern.
export const REGEX_DEBOUNCE_MS = 120;

function createWorker() {
  return new Worker(new URL("../regex/regex.worker.js", import.meta.url), {
    type: "module",
  });
}

/**
 * State of the Regex view mode. Pattern / flags / replacement persist in
 * localStorage; the test text lives for the session and is seeded from
 * `seed` (the current input) the first time the view opens. Matching runs
 * in a worker (see regex/runner.js) while `active`.
 *
 * `result` is null before the first run, else one of
 *   { status: "empty" }                     no pattern
 *   { status: "error", error }              invalid pattern / worker crash
 *   { status: "timeout" }                   run killed after the timeout
 *   { status: "ok", matches, truncated, groupNames, replaced, elapsedMs }
 * plus `forText`: the test text the result was computed for, so stale
 * ranges are never painted onto newer text.
 */
export function useRegexTester({ active, seed }) {
  const [state, setState] = usePersistentState(
    STORAGE_KEYS.regex,
    () => loadRegexState(getStorage()),
    { delay: 400 }
  );
  const [text, setText] = useState(null);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const runnerRef = useRef(null);

  // Seed the test text from the input when the view first opens.
  useEffect(() => {
    if (active && text === null) setText(seed ?? "");
  }, [active, text, seed]);

  useEffect(
    () => () => {
      runnerRef.current?.dispose();
      runnerRef.current = null;
    },
    []
  );

  const { pattern, flags, replacement } = state;
  useEffect(() => {
    if (!active || text === null) return;
    if (!pattern) {
      setResult({ status: "empty", forText: text });
      setRunning(false);
      return;
    }
    // Compiling can't hang, so syntax errors show up immediately.
    const compiled = compileRegex(pattern, flags);
    if (compiled.error) {
      setResult({ status: "error", error: compiled.error, forText: text });
      setRunning(false);
      return;
    }
    let stale = false;
    const t = setTimeout(async () => {
      if (!runnerRef.current) runnerRef.current = createRegexRunner({ createWorker });
      setRunning(true);
      const res = await runnerRef.current.run({
        pattern,
        flags,
        text,
        replacement,
        maxMatches: MAX_MATCHES,
      });
      if (res.status === "cancelled" || stale) return;
      setRunning(false);
      setResult({ ...res, forText: text });
    }, REGEX_DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [active, pattern, flags, replacement, text]);

  const update = useCallback((patch) => setState((s) => ({ ...s, ...patch })), [setState]);

  return {
    pattern,
    flags,
    replacement,
    setPattern: useCallback((p) => update({ pattern: p }), [update]),
    setFlags: useCallback((f) => update({ flags: f }), [update]),
    setReplacement: useCallback((r) => update({ replacement: r }), [update]),
    update,
    text: text ?? "",
    setText,
    reseed: useCallback(() => setText(seed ?? ""), [seed]),
    result,
    running,
  };
}
