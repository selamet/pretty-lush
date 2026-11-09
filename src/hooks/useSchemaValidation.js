import { useEffect, useMemo, useRef, useState } from "react";
import { STORAGE_KEYS, getStorage } from "../state/storage.js";
import { loadSchemaState } from "../state/schema.js";
import { usePersistentState } from "./usePersistentState.js";
// validate.js is small; Ajv itself is imported lazily inside it.
import { validateJson } from "../schema/validate.js";

// Delay after the last keystroke (input or schema) before re-validating.
export const SCHEMA_DEBOUNCE_MS = 300;

// Persisted { open, text } of the Schema panel (debounced writes: the schema
// text changes on every keystroke).
export function useSchemaState() {
  return usePersistentState(
    STORAGE_KEYS.schema,
    () => loadSchemaState(getStorage()),
    { delay: 400 }
  );
}

const LOADING = { status: "loading" };
const EMPTY = { status: "empty" };

/**
 * Debounced validation of the JSON `input` against `schemaText` while
 * `enabled`. Results for stale inputs are dropped.
 *
 * @returns {null | { status: "loading"|"empty"|"valid"|"invalid"|
 *   "schema-error"|"input-error", dialect?, errors?, error?,
 *   diagnostics: Array }} null when disabled. `diagnostics` are CodeMirror
 *   lint diagnostics for the input editor (stable identity per result).
 */
export function useSchemaValidation({ enabled, input, schemaText }) {
  const [result, setResult] = useState(LOADING);
  const runId = useRef(0);
  const hasRun = useRef(false);

  useEffect(() => {
    const id = ++runId.current;
    if (!enabled) {
      hasRun.current = false;
      setResult(LOADING);
      return;
    }
    if (!schemaText.trim()) {
      setResult(EMPTY);
      return;
    }
    // First run after enabling is immediate; later ones are debounced.
    const delay = hasRun.current ? SCHEMA_DEBOUNCE_MS : 0;
    const t = setTimeout(async () => {
      hasRun.current = true;
      let r;
      try {
        r = await validateJson(input, schemaText);
      } catch (e) {
        // Ajv chunk failed to load (offline before first use, …).
        r = {
          status: "schema-error",
          error: { message: `Validator unavailable: ${e?.message || e}`, line: null, column: null, hint: null },
        };
      }
      if (id === runId.current) setResult(r);
    }, delay);
    return () => clearTimeout(t);
  }, [enabled, input, schemaText]);

  const diagnostics = useMemo(() => {
    if (result.status !== "invalid") return [];
    return result.errors.map((e) => ({
      from: e.from,
      to: Math.max(e.from, e.to),
      severity: "error",
      message: `${e.instancePath || "(root)"}: ${e.message}`,
      source: `JSON Schema · ${e.keyword}`,
    }));
  }, [result]);

  return useMemo(
    () => (enabled ? { ...result, diagnostics } : null),
    [enabled, result, diagnostics]
  );
}
