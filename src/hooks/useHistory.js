import { usePersistentState } from "./usePersistentState.js";
import { STORAGE_KEYS, getStorage } from "../state/storage.js";
import { addHistoryEntry, loadHistory } from "../state/history.js";

// Recent-format history, persisted to localStorage.
export function useHistory() {
  const [history, setHistory] = usePersistentState(STORAGE_KEYS.history, () =>
    loadHistory(getStorage())
  );

  function pushHistory(entry) {
    setHistory((prev) => addHistoryEntry(prev, entry));
  }

  function clearHistory() {
    setHistory([]);
  }

  return { history, pushHistory, clearHistory };
}
