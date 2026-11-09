// Cron expression explainer: parse → description + field breakdown + next
// run times. Pure; the "Cron" tool modal (components/CronModal.jsx) is the
// only UI consumer.
import { parseCron, CronError, FIELDS } from "./parse.js";
import { describeCron, summarizeField } from "./describe.js";
import { nextRuns } from "./schedule.js";

export { parseCron, CronError, describeCron, nextRuns, summarizeField };

export const CRON_PRESETS = [
  { label: "Every minute", expression: "* * * * *" },
  { label: "Every 5 minutes", expression: "*/5 * * * *" },
  { label: "Hourly", expression: "0 * * * *" },
  { label: "Daily at midnight", expression: "0 0 * * *" },
  { label: "Weekdays at 09:00", expression: "0 9 * * 1-5" },
  { label: "Weekly (Sunday)", expression: "0 0 * * 0" },
  { label: "Monthly (1st)", expression: "0 0 1 * *" },
  { label: "Every 30 seconds", expression: "*/30 * * * * *" },
];

export const DEFAULT_CRON = "0 9 * * 1-5";

// Allowed values shown in the breakdown table.
const RANGE_TEXT = {
  second: "0–59",
  minute: "0–59",
  hour: "0–23",
  dom: "1–31",
  month: "1–12 or JAN–DEC",
  dow: "0–7 or SUN–SAT (0, 7 = Sun)",
};

/**
 * Everything the Cron modal shows for one expression.
 *
 * @param {string} expression
 * @param {{ now?: Date|number, count?: number, utc?: boolean }} [opts]
 * @returns {{
 *   ok: true,
 *   description: string,
 *   reboot: boolean,
 *   hasSeconds: boolean,
 *   macro: string|null,
 *   fields: { id, label, raw, summary, allowed }[],   // [] for @reboot
 *   runs: Date[],
 *   never: boolean,          // no run within the search horizon
 * } | { ok: false, error: string }}
 */
export function explainCron(expression, opts = {}) {
  let parsed;
  try {
    parsed = parseCron(expression);
  } catch (e) {
    if (e instanceof CronError) return { ok: false, error: e.message };
    throw e;
  }
  if (parsed.reboot) {
    return {
      ok: true,
      description: describeCron(parsed),
      reboot: true,
      hasSeconds: false,
      macro: parsed.macro,
      fields: [],
      runs: [],
      never: false,
    };
  }
  const runs = nextRuns(parsed, opts);
  const fields = FIELDS.filter((f) => parsed.hasSeconds || f.id !== "second").map((f) => {
    const field = parsed.fields[f.id];
    return {
      id: f.id,
      label: f.label,
      raw: field.raw,
      summary: summarizeField(field),
      allowed: RANGE_TEXT[f.id],
    };
  });
  return {
    ok: true,
    description: describeCron(parsed),
    reboot: false,
    hasSeconds: parsed.hasSeconds,
    macro: parsed.macro,
    fields,
    runs,
    never: runs.length === 0,
  };
}

// Extracts a cron expression from one line: a macro, 6 fields or 5 fields
// (a crontab line's trailing command is ignored). Returns null otherwise.
export function extractCron(line) {
  const text = String(line ?? "").trim();
  if (!text || text.startsWith("#")) return null;
  const tokens = text.split(/\s+/);
  if (tokens[0].startsWith("@")) {
    try {
      parseCron(tokens[0]);
      return tokens[0];
    } catch {
      return null;
    }
  }
  for (const n of [6, 5]) {
    if (tokens.length < n) continue;
    const candidate = tokens.slice(0, n).join(" ");
    // Every field must at least look like cron syntax; this keeps prose
    // and code lines (which can parse by accident) out.
    if (!tokens.slice(0, n).every((t) => /^[\d*?,/\-A-Za-z]+$/.test(t))) continue;
    if (!tokens.slice(0, n).some((t) => /[\d*?]/.test(t))) continue;
    try {
      parseCron(candidate);
      return candidate;
    } catch {
      // try the shorter form
    }
  }
  return null;
}

/**
 * Initial expression for the Cron modal: the selection if it is cron, else
 * the line under the cursor, else the first cron-looking line of the input,
 * else the default.
 *
 * @param {{ selection?: string, cursorLine?: string, input?: string }} src
 */
export function pickCronExpression({ selection = "", cursorLine = "", input = "" } = {}) {
  for (const line of String(selection).split("\n")) {
    const found = extractCron(line);
    if (found) return found;
  }
  const fromCursor = extractCron(cursorLine);
  if (fromCursor) return fromCursor;
  for (const line of String(input).split("\n").slice(0, 200)) {
    const found = extractCron(line);
    if (found) return found;
  }
  return DEFAULT_CRON;
}

// "in 45 s", "in 12 min", "in 3 h 5 min", "in 2 days", "in 4 years" —
// the time from `now` until `date`, for the next-runs list.
export function formatRelative(date, now = Date.now()) {
  const nowMs = typeof now === "number" ? now : now.getTime();
  const s = Math.max(0, Math.round((date.getTime() - nowMs) / 1000));
  if (s < 60) return `in ${s} s`;
  const min = Math.floor(s / 60);
  if (min < 60) return `in ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return min % 60 ? `in ${h} h ${min % 60} min` : `in ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 365) return `in ${days} ${days === 1 ? "day" : "days"}`;
  const years = Math.floor(days / 365);
  return `in ${years} ${years === 1 ? "year" : "years"}`;
}
