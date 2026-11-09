import { useEffect, useRef, useState } from "react";
import { mapRuffDiagnostics } from "../lint/ruff-diagnostics.js";
// python.js is tiny; the Ruff WASM it wraps is itself loaded lazily.
import { lintPython } from "../formatters/python.js";

// Delay after the last keystroke before Ruff re-checks the input.
export const LINT_DEBOUNCE_MS = 350;

const IDLE = { diagnostics: [], status: "loading" };

/**
 * Debounced Ruff lint of `input` while `enabled`. Runs independently of
 * formatting (its own async flow, results for stale inputs are dropped) and
 * reuses the formatter's lazily loaded Ruff Workspace.
 *
 * @returns {null | { diagnostics: Array, status: "loading"|"ready"|"error" }}
 *   null when lint is disabled, so callers can clear markers and hide the
 *   problems list.
 */
export function useRuffLint({ enabled, input, settings }) {
  const [result, setResult] = useState(IDLE);
  const runId = useRef(0);
  const hasRun = useRef(false);
  const { indent, lineWidth, quotes } = settings;

  useEffect(() => {
    if (!enabled) {
      runId.current++;
      hasRun.current = false;
      setResult(IDLE);
      return;
    }
    const id = ++runId.current;
    // First check after enabling runs right away; later ones are debounced.
    const delay = hasRun.current ? LINT_DEBOUNCE_MS : 0;
    const t = setTimeout(async () => {
      hasRun.current = true;
      try {
        const raw = await lintPython(input, { indent, lineWidth, quotes });
        if (id !== runId.current) return;
        setResult({ diagnostics: mapRuffDiagnostics(raw, input), status: "ready" });
      } catch {
        if (id !== runId.current) return;
        setResult({ diagnostics: [], status: "error" });
      }
    }, delay);
    return () => clearTimeout(t);
  }, [enabled, input, indent, lineWidth, quotes]);

  return enabled ? result : null;
}
