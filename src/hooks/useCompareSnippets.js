import { useEffect, useState } from "react";
import { STORAGE_KEYS, getStorage, writeJSON } from "../state/storage.js";
import { loadCompare } from "../state/workspace.js";

const SAVE_DELAY_MS = 400;

// Compare mode A / B bodies, persisted (debounced).
export function useCompareSnippets() {
  const [initial] = useState(() => loadCompare(getStorage()));
  const [compareA, setCompareA] = useState(initial.a);
  const [compareB, setCompareB] = useState(initial.b);

  useEffect(() => {
    const t = setTimeout(() => {
      writeJSON(STORAGE_KEYS.compare, { a: compareA, b: compareB });
    }, SAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [compareA, compareB]);

  return { compareA, setCompareA, compareB, setCompareB };
}
