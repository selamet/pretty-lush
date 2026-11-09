import { STORAGE_KEYS } from "./storage.js";

export const MAX_HISTORY = 20;
// Inputs larger than this are formatted but not recorded in history.
export const MAX_HISTORY_ITEM = 50_000;
// How many entries the sidebar "Recent" list shows.
export const RECENT_VISIBLE = 8;

export function loadHistory(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEYS.history);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Prepends `entry`, dropping any older entry with the same language + input,
// and caps the list at `max` items.
export function addHistoryEntry(prev, entry, max = MAX_HISTORY) {
  const filtered = prev.filter(
    (e) => !(e.lang === entry.lang && e.input === entry.input)
  );
  return [entry, ...filtered].slice(0, max);
}

export function createHistoryEntry({
  lang,
  input,
  output,
  now = Date.now(),
  random = Math.random,
}) {
  return {
    id: `${now}-${random().toString(36).slice(2, 6)}`,
    ts: now,
    lang,
    input,
    snippet: input.replace(/\s+/g, " ").slice(0, 80).trim(),
    inSize: input.length,
    outSize: output.length,
  };
}

export function formatRelativeTime(ts, now = Date.now()) {
  const sec = Math.max(0, (now - ts) / 1000);
  if (sec < 45) return "just now";
  if (sec < 90) return "a minute ago";
  const min = sec / 60;
  if (min < 45) return `${Math.round(min)} min ago`;
  if (min < 90) return "an hour ago";
  const hr = min / 60;
  if (hr < 24) return `${Math.round(hr)} h ago`;
  const day = hr / 24;
  if (day < 2) return "yesterday";
  return `${Math.round(day)} d ago`;
}
