import { useEffect, useState } from "react";
import { STORAGE_KEYS, getStorage, writeJSON } from "../state/storage.js";
import { loadWorkspace, serializeWorkspace } from "../state/workspace.js";

const SAVE_DELAY_MS = 500;

// Current language + per-language editor inputs, persisted (debounced).
export function useWorkspace() {
  const [initial] = useState(() => loadWorkspace(getStorage()));
  const [lang, setLang] = useState(initial.lang);
  const [inputs, setInputs] = useState(initial.inputs);

  useEffect(() => {
    const t = setTimeout(() => {
      writeJSON(STORAGE_KEYS.workspace, serializeWorkspace(lang, inputs));
    }, SAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [lang, inputs]);

  return { lang, setLang, inputs, setInputs };
}
