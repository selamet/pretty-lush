// Plain-English description of a parsed cron expression.
//
//   "0 9 * * 1-5"     → "At 09:00 on Monday through Friday"
//   "*/5 * * * *"     → "Every 5 minutes"
//   "0 8-18/2 * * *"  → "At minute 0 past every 2nd hour from 8 through 18"
import { MONTH_NAMES, DAY_NAMES } from "./parse.js";

const pad2 = (n) => String(n).padStart(2, "0");

export function ordinal(n) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th"}`;
}

export function joinList(items, conjunction = "and") {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${conjunction} ${items[items.length - 1]}`;
}

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const UNITS = {
  second: { one: "second", many: "seconds", fmt: String },
  minute: { one: "minute", many: "minutes", fmt: String },
  hour: { one: "hour", many: "hours", fmt: String },
  dom: { one: "day", many: "days", fmt: String },
  month: { one: "month", many: "months", fmt: (v) => MONTH_NAMES[v - 1] },
  dow: { one: "day of the week", many: "days", fmt: (v) => DAY_NAMES[v % 7] },
};

const isSingle = (p) => !p.star && p.start === p.end;
const allSingles = (field) => field.parts.every(isSingle);
const isTrivialStar = (field) => field.parts.length === 1 && field.parts[0].star && field.parts[0].step === 1;
// `*/n` (or `?/n`): every n-th value from the field minimum.
const starStep = (field) =>
  field.parts.length === 1 && field.parts[0].star && field.parts[0].step > 1
    ? field.parts[0].step
    : null;

// Phrase for one non-single part, e.g. "every 2nd hour from 8 through 18".
function partPhrase(part, id) {
  const u = UNITS[id];
  const named = id === "month" || id === "dow";
  if (part.star) {
    return part.step === 1 ? `every ${u.one}` : `every ${ordinal(part.step)} ${u.one}`;
  }
  const range = `${u.fmt(part.start)} through ${u.fmt(part.end === 7 && id === "dow" ? 0 : part.end)}`;
  if (part.step === 1) return named ? range : `every ${u.one} from ${range}`;
  return `every ${ordinal(part.step)} ${u.one} from ${range}`;
}

// Phrase for a whole field used as a qualifier ("hours 9 and 17",
// "every 2nd hour from 8 through 18", "Monday, Wednesday and Friday").
function fieldPhrase(field) {
  const { id } = field;
  const u = UNITS[id];
  const named = id === "month" || id === "dow";
  if (allSingles(field)) {
    const values = field.parts.map((p) => u.fmt(p.start));
    if (named) return joinList(values);
    return `${values.length === 1 ? u.one : u.many} ${joinList(values)}`;
  }
  const phrases = field.parts.map((p) =>
    isSingle(p) ? (named ? u.fmt(p.start) : `${u.one} ${u.fmt(p.start)}`) : partPhrase(p, id)
  );
  return joinList(phrases);
}

// Leading clause for the finest-grained field (second or minute).
function leadingPhrase(field) {
  const u = UNITS[field.id];
  if (isTrivialStar(field)) return `Every ${u.one}`;
  const step = starStep(field);
  if (step) return `Every ${step} ${u.many}`;
  if (allSingles(field)) return `At ${fieldPhrase(field)}`;
  if (field.parts.length === 1) return capitalize(partPhrase(field.parts[0], field.id));
  return `At ${fieldPhrase(field)}`;
}

function timeOf(h, m, s, withSeconds) {
  return withSeconds ? `${pad2(h)}:${pad2(m)}:${pad2(s)}` : `${pad2(h)}:${pad2(m)}`;
}

// "At 09:00", "At 09:00 and 17:30" when second / minute / hour are plain
// values and there are only a few combinations.
function clockTimes(fields) {
  const { second, minute, hour } = fields;
  if (!(allSingles(second) && second.values.length === 1)) return null;
  if (!allSingles(minute) || !allSingles(hour)) return null;
  if (minute.values.length * hour.values.length > 6) return null;
  const s = second.values[0];
  const times = [];
  for (const h of hour.values) {
    for (const m of minute.values) times.push(timeOf(h, m, s, s !== 0));
  }
  return `At ${joinList(times)}`;
}

// "Every 15 minutes from 09:00 through 17:59" for `*/15 9-17 * * *`.
function minuteWindow(fields) {
  const { second, minute, hour } = fields;
  if (!(second.values.length === 1 && second.values[0] === 0)) return null;
  const step = starStep(minute);
  if (!isTrivialStar(minute) && !step) return null;
  if (hour.parts.length !== 1 || hour.parts[0].star || hour.parts[0].step !== 1) return null;
  const { start, end } = hour.parts[0];
  const lastMinute = minute.values[minute.values.length - 1];
  const lead = step ? `Every ${step} minutes` : "Every minute";
  return `${lead} from ${timeOf(start, 0)} through ${timeOf(end, lastMinute)}`;
}

function timePhrase(fields, hasSeconds) {
  const clock = clockTimes(fields);
  if (clock) return clock;
  const window = minuteWindow(fields);
  if (window) return window;

  const { second, minute, hour } = fields;
  const secondsMatter = hasSeconds && !(second.values.length === 1 && second.values[0] === 0);
  const parts = [];
  if (secondsMatter) {
    parts.push(leadingPhrase(second));
    if (!isTrivialStar(minute)) parts.push(`past ${fieldPhrase(minute)}`);
    else if (!isTrivialStar(second) && !starStep(second)) parts.push("past every minute");
  } else {
    // "Every hour" / "Every 2 hours" for minute 0 of every (n-th) hour.
    if (minute.values.length === 1 && minute.values[0] === 0 && allSingles(minute)) {
      if (isTrivialStar(hour)) return "Every hour";
      const hourStep = starStep(hour);
      if (hourStep) return `Every ${hourStep} hours`;
    }
    parts.push(leadingPhrase(minute));
  }
  const hourStar = isTrivialStar(hour);
  if (!hourStar) {
    parts.push(`past ${fieldPhrase(hour)}`);
  } else if (!secondsMatter && !isTrivialStar(minute) && !starStep(minute)) {
    // "At minute 15 past every hour"; "Every 5 minutes" needs no suffix.
    parts.push("past every hour");
  } else if (secondsMatter && !isTrivialStar(minute)) {
    parts.push("past every hour");
  }
  return parts.join(" ");
}

function domPhrase(dom) {
  const step = starStep(dom);
  if (step) return `every ${ordinal(step)} day of the month`;
  if (allSingles(dom)) {
    return `day${dom.values.length === 1 ? "" : "s"} ${joinList(dom.values.map(String))} of the month`;
  }
  const phrases = dom.parts.map((p) => {
    if (isSingle(p)) return `day ${p.start}`;
    if (p.step === 1) return `days ${p.start} through ${p.end}`;
    return `every ${ordinal(p.step)} day from ${p.start} through ${p.end}`;
  });
  return `${joinList(phrases)} of the month`;
}

function dowPhrase(dow) {
  // `*/2` → "Sunday, Tuesday, Thursday and Saturday" (clearer than "every
  // 2nd day of the week", which reads as every other day).
  if (starStep(dow)) return joinList(dow.values.map((v) => DAY_NAMES[v]));
  return fieldPhrase(dow);
}

function datePhrase(fields) {
  const { dom, dow, month } = fields;
  const domRestricted = !isTrivialStar(dom);
  const dowRestricted = !isTrivialStar(dow);
  const out = [];
  if (domRestricted && dowRestricted) {
    if (!dom.star && !dow.star) {
      // Both restricted: standard cron runs when EITHER matches.
      out.push(`on ${domPhrase(dom)} or on ${dowPhrase(dow)}`);
    } else {
      // One side starts with "*" (e.g. `*/2`): both must match (Vixie).
      const days = dow.star
        ? joinList(dow.values.map((v) => DAY_NAMES[v]), "or")
        : fieldPhrase(dow);
      out.push(`on ${domPhrase(dom)}, if it is ${days}`);
    }
  } else if (domRestricted) {
    out.push(`on ${domPhrase(dom)}`);
  } else if (dowRestricted) {
    out.push(`on ${dowPhrase(dow)}`);
  }
  if (!isTrivialStar(month)) {
    const step = starStep(month);
    out.push(step ? `in every ${ordinal(step)} month` : `in ${fieldPhrase(month)}`);
  }
  return out.join(" ");
}

/**
 * @param {object} parsed  result of parseCron
 * @returns {string}
 */
export function describeCron(parsed) {
  if (parsed.reboot) return "At startup";
  const { fields, hasSeconds } = parsed;
  const time = timePhrase(fields, hasSeconds);
  const date = datePhrase(fields);
  return date ? `${time} ${date}` : time;
}

// Compact value summary for the field breakdown table, e.g. "every",
// "0, 15, 30, 45", "Monday–Friday", "1–5, 10".
export function summarizeField(field) {
  if (field.all) return "every";
  const fmt = field.id === "month" || field.id === "dow"
    ? (v) => UNITS[field.id].fmt(v).slice(0, 3)
    : String;
  const runs = [];
  for (const v of field.values) {
    const last = runs[runs.length - 1];
    if (last && v === last[1] + 1) last[1] = v;
    else runs.push([v, v]);
  }
  return runs
    .map(([a, b]) => {
      if (a === b) return fmt(a);
      if (b === a + 1) return `${fmt(a)}, ${fmt(b)}`;
      return `${fmt(a)}–${fmt(b)}`;
    })
    .join(", ");
}
