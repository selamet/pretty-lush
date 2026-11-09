// Cron expression parser (pure, no dependencies).
//
// Accepts classic 5-field expressions (minute hour day-of-month month
// day-of-week), 6-field expressions with a leading seconds field, and the
// @-macros. Supports `*`, `?` (same as `*`), lists, ranges, steps
// (`*/5`, `1-10/2`, `5/15`), month / weekday names and 7 as Sunday.
// Quartz-only syntax (`L`, `W`, `#`, a year field) is rejected with a clear
// error instead of being silently misread.

export class CronError extends Error {
  constructor(message) {
    super(message);
    this.name = "CronError";
  }
}

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const MONTH_ALIASES = Object.fromEntries(
  MONTH_NAMES.map((n, i) => [n.slice(0, 3).toUpperCase(), i + 1])
);
const DAY_ALIASES = Object.fromEntries(
  DAY_NAMES.map((n, i) => [n.slice(0, 3).toUpperCase(), i])
);

// Field metadata, in 6-field order. `max` for day-of-week is 7 so "7" and
// ranges ending in 7 parse; 7 is folded into 0 (Sunday) afterwards.
export const FIELDS = [
  { id: "second", label: "Second", min: 0, max: 59 },
  { id: "minute", label: "Minute", min: 0, max: 59 },
  { id: "hour", label: "Hour", min: 0, max: 23 },
  { id: "dom", label: "Day of month", min: 1, max: 31 },
  { id: "month", label: "Month", min: 1, max: 12, aliases: MONTH_ALIASES },
  { id: "dow", label: "Day of week", min: 0, max: 7, aliases: DAY_ALIASES },
];

export const MACROS = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

function parseValue(token, field) {
  const upper = token.toUpperCase();
  if (field.aliases && upper in field.aliases) return field.aliases[upper];
  if (!/^\d+$/.test(token)) {
    throw new CronError(`${field.label}: "${token}" is not a valid value`);
  }
  const n = Number(token);
  if (n < field.min || n > field.max) {
    throw new CronError(
      `${field.label}: ${n} is out of range (${field.min}–${field.max})`
    );
  }
  return n;
}

function rejectQuartz(raw, field) {
  if (/#/.test(raw)) {
    throw new CronError(
      `${field.label}: "#" (nth weekday of the month) is Quartz syntax and is not supported`
    );
  }
  // `L` / `W` as standalone tokens or suffixes ("L", "5L", "15W", "LW").
  if (/(^|[^A-Z])(L|W|LW)($|[^A-Z])|\dL|\dW|^L-/i.test(raw)) {
    throw new CronError(
      `${field.label}: "L" / "W" (last day / nearest weekday) is Quartz syntax and is not supported`
    );
  }
}

// One comma-separated part → { start, end, step, star }.
function parsePart(part, field) {
  if (part === "") throw new CronError(`${field.label}: empty list item`);
  const [rangeText, stepText, extra] = part.split("/");
  if (extra !== undefined) {
    throw new CronError(`${field.label}: "${part}" has more than one "/"`);
  }
  let step = 1;
  if (stepText !== undefined) {
    if (!/^\d+$/.test(stepText) || Number(stepText) === 0) {
      throw new CronError(
        `${field.label}: step "${stepText}" must be a positive whole number`
      );
    }
    step = Number(stepText);
  }
  if (rangeText === "*" || rangeText === "?") {
    if (rangeText === "?" && field.id !== "dom" && field.id !== "dow") {
      throw new CronError(
        `${field.label}: "?" is only allowed in the day-of-month and day-of-week fields`
      );
    }
    return { start: field.min, end: field.id === "dow" ? 6 : field.max, step, star: true };
  }
  const bounds = rangeText.split("-");
  if (bounds.length > 2 || bounds.some((b) => b === "")) {
    throw new CronError(`${field.label}: "${rangeText}" is not a valid range`);
  }
  const start = parseValue(bounds[0], field);
  if (bounds.length === 1) {
    // `5/15` means "from 5 through the maximum, every 15".
    const end = stepText !== undefined ? (field.id === "dow" ? 6 : field.max) : start;
    return { start, end: Math.max(start, end), step, star: false };
  }
  const end = parseValue(bounds[1], field);
  if (end < start) {
    throw new CronError(
      `${field.label}: range ${bounds[0]}-${bounds[1]} goes backwards (start must not exceed end)`
    );
  }
  return { start, end, step, star: false };
}

function parseField(raw, field) {
  rejectQuartz(raw, field);
  const parts = raw.split(",").map((p) => parsePart(p, field));
  const set = new Set();
  for (const p of parts) {
    for (let v = p.start; v <= p.end; v += p.step) {
      set.add(field.id === "dow" && v === 7 ? 0 : v);
    }
  }
  const values = [...set].sort((a, b) => a - b);
  // Vixie cron: a day field whose text starts with "*" (or "?") counts as
  // unrestricted for the day-of-month / day-of-week OR rule.
  const star = raw.startsWith("*") || raw.startsWith("?");
  const span = field.id === "dow" ? 7 : field.max - field.min + 1;
  return { id: field.id, label: field.label, raw, parts, values, star, all: values.length === span };
}

/**
 * Parses a cron expression.
 *
 * @param {string} expression
 * @returns {{
 *   expression: string,          // trimmed input
 *   macro: string|null,          // "@daily", … or null
 *   reboot: boolean,             // @reboot: runs at startup only
 *   hasSeconds: boolean,         // 6-field form
 *   fields: Record<string, object>|null,
 * }}
 * @throws {CronError}
 */
export function parseCron(expression) {
  const text = String(expression ?? "").trim();
  if (!text) throw new CronError("Enter a cron expression");
  if (text.startsWith("@")) {
    const macro = text.toLowerCase();
    if (macro === "@reboot") {
      return { expression: text, macro, reboot: true, hasSeconds: false, fields: null };
    }
    if (!(macro in MACROS)) {
      throw new CronError(
        `Unknown macro "${text}" (use @yearly, @annually, @monthly, @weekly, @daily, @midnight, @hourly or @reboot)`
      );
    }
    return { ...parseFields(MACROS[macro].split(" ")), expression: text, macro };
  }
  const tokens = text.split(/\s+/);
  if (tokens.length === 7) {
    throw new CronError(
      "7 fields: the Quartz year field is not supported (use 5 fields, or 6 with seconds)"
    );
  }
  if (tokens.length !== 5 && tokens.length !== 6) {
    throw new CronError(
      `Expected 5 fields (minute hour day-of-month month day-of-week) or 6 with seconds — got ${tokens.length}`
    );
  }
  try {
    return { ...parseFields(tokens), expression: text, macro: null };
  } catch (e) {
    if (tokens.length === 6 && /^\d{4}$/.test(tokens[5])) {
      throw new CronError(
        "6 fields are read as seconds + 5 fields; a trailing Quartz year field is not supported"
      );
    }
    throw e;
  }
}

function parseFields(tokens) {
  const hasSeconds = tokens.length === 6;
  const all = hasSeconds ? tokens : ["0", ...tokens];
  const fields = {};
  FIELDS.forEach((f, i) => {
    fields[f.id] = parseField(all[i], f);
  });
  return { reboot: false, hasSeconds, fields };
}
