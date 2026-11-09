// Next run times for a parsed cron expression.
//
// The search works on calendar fields (year, month, day, hour, minute,
// second) and jumps straight to the next allowed value of each field, so a
// yearly schedule costs a handful of steps, not a minute-by-minute scan.
// It is bounded by SEARCH_YEARS, so impossible dates (Feb 30) terminate and
// report "never runs".
//
// Times are computed either in UTC or in the runtime's local time zone. In
// local time, wall-clock times skipped by a DST jump are skipped (like
// most cron daemons skip them when the clock springs forward), and a time
// repeated when the clock falls back runs once.

// Long enough to find Feb 29 on a weekday-restricted (AND) schedule across
// the century gap (2096 → 2104) and any 28-year weekday/date cycle.
const SEARCH_YEARS = 100;

function daysInMonth(year, month) {
  // month is 1-based; day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function dayOfWeek(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

// Smallest allowed value ≥ v, or undefined.
function nextIn(values, v) {
  for (const x of values) if (x >= v) return x;
  return undefined;
}

function dayMatches(fields, year, month, day) {
  const { dom, dow } = fields;
  const domOk = dom.values.includes(day);
  const dowOk = dow.values.includes(dayOfWeek(year, month, day));
  // Standard (Vixie) cron: when both day fields are restricted, a day
  // matching either one runs; otherwise both must match (the star side
  // always does).
  if (!dom.star && !dow.star) return domOk || dowOk;
  return domOk && dowOk;
}

// Next matching calendar tuple ≥ t, or null when none within the horizon.
function nextTuple(fields, t, maxYear) {
  let { year, month, day, hour, minute, second } = t;
  const reset = (level) => {
    if (level <= 1) day = 1;
    if (level <= 2) hour = 0;
    if (level <= 3) minute = 0;
    if (level <= 4) second = 0;
  };
  while (year <= maxYear) {
    const m = nextIn(fields.month.values, month);
    if (m === undefined) {
      year += 1;
      month = 1;
      reset(1);
      continue;
    }
    if (m !== month) {
      month = m;
      reset(1);
    }
    const dim = daysInMonth(year, month);
    let d = day;
    while (d <= dim && !dayMatches(fields, year, month, d)) d += 1;
    if (d > dim) {
      month += 1;
      reset(1);
      if (month > 12) {
        month = 1;
        year += 1;
      }
      continue;
    }
    if (d !== day) {
      day = d;
      reset(2);
    }
    const h = nextIn(fields.hour.values, hour);
    if (h === undefined) {
      day += 1;
      reset(2);
      continue;
    }
    if (h !== hour) {
      hour = h;
      reset(3);
    }
    const mi = nextIn(fields.minute.values, minute);
    if (mi === undefined) {
      hour += 1;
      reset(3);
      continue;
    }
    if (mi !== minute) {
      minute = mi;
      reset(4);
    }
    const s = nextIn(fields.second.values, second);
    if (s === undefined) {
      minute += 1;
      reset(4);
      continue;
    }
    return { year, month, day, hour, minute, second: s };
  }
  return null;
}

function toTuple(date, utc) {
  return utc
    ? {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
        hour: date.getUTCHours(),
        minute: date.getUTCMinutes(),
        second: date.getUTCSeconds(),
      }
    : {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
        hour: date.getHours(),
        minute: date.getMinutes(),
        second: date.getSeconds(),
      };
}

function fromTuple(t, utc) {
  return utc
    ? new Date(Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second))
    : new Date(t.year, t.month - 1, t.day, t.hour, t.minute, t.second);
}

function sameTuple(a, b) {
  return (
    a.year === b.year &&
    a.month === b.month &&
    a.day === b.day &&
    a.hour === b.hour &&
    a.minute === b.minute &&
    a.second === b.second
  );
}

/**
 * Next `count` run times strictly after `now`.
 *
 * @param {object} parsed   result of parseCron (not @reboot)
 * @param {object} [opts]
 * @param {Date|number} [opts.now]   defaults to the current time
 * @param {number} [opts.count=5]
 * @param {boolean} [opts.utc=false] compute in UTC instead of local time
 * @returns {Date[]} fewer than `count` (possibly empty) when the schedule
 *   never runs again within the search horizon
 */
export function nextRuns(parsed, { now = Date.now(), count = 5, utc = false } = {}) {
  if (!parsed?.fields) return [];
  const { fields } = parsed;
  const nowMs = typeof now === "number" ? now : now.getTime();
  // Start at the next whole second after `now`.
  const start = new Date(Math.floor(nowMs / 1000) * 1000 + 1000);
  let t = toTuple(start, utc);
  const maxYear = t.year + SEARCH_YEARS;
  const runs = [];
  // Each iteration either records a run or skips one non-existent / already
  // passed local time, so the guard only matters for pathological DST data.
  for (let guard = 0; runs.length < count && guard < count * 50; guard += 1) {
    const next = nextTuple(fields, t, maxYear);
    if (!next) break;
    const date = fromTuple(next, utc);
    // Local wall-clock time that doesn't exist (DST gap) normalizes to a
    // different time; one repeated by a fall-back may map to ≤ now.
    if (sameTuple(toTuple(date, utc), next) && date.getTime() > nowMs) {
      runs.push(date);
    }
    t = { ...next, second: next.second + 1 };
  }
  return runs;
}
