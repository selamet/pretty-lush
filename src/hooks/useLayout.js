import { usePersistentState } from "./usePersistentState.js";
import { STORAGE_KEYS, getStorage } from "../state/storage.js";
import { loadLayout } from "../state/layout.js";

// Sidebar width + input/output split ratio, persisted to localStorage.
export function useLayout() {
  return usePersistentState(STORAGE_KEYS.layout, () => loadLayout(getStorage()));
}
