import { useEffect, useState } from "react";
import { writeJSON } from "../state/storage.js";

// useState that mirrors its value to localStorage as JSON on every change.
// `init` is the usual lazy initializer and should read the stored value
// (see the loaders in src/state/). Pass `delay` (ms) to debounce writes for
// values that change on every keystroke.
export function usePersistentState(key, init, { delay = 0 } = {}) {
  const [value, setValue] = useState(init);

  useEffect(() => {
    if (!delay) {
      writeJSON(key, value);
      return;
    }
    const t = setTimeout(() => writeJSON(key, value), delay);
    return () => clearTimeout(t);
  }, [key, value, delay]);

  return [value, setValue];
}
