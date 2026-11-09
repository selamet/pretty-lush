import { describe, it, expect, afterEach } from "vitest";
import { parseCron } from "./parse.js";
import { nextRuns } from "./schedule.js";

// Monday 2026-11-09 10:17:23 UTC.
const NOW = Date.UTC(2026, 10, 9, 10, 17, 23);
const iso = (dates) => dates.map((x) => x.toISOString().replace(".000Z", "Z"));
const runs = (expr, opts = {}) =>
  iso(nextRuns(parseCron(expr), { now: NOW, utc: true, ...opts }));

describe("nextRuns (UTC)", () => {
  it("every minute starts at the next whole minute", () => {
    expect(runs("* * * * *")).toEqual([
      "2026-11-09T10:18:00Z",
      "2026-11-09T10:19:00Z",
      "2026-11-09T10:20:00Z",
      "2026-11-09T10:21:00Z",
      "2026-11-09T10:22:00Z",
    ]);
  });

  it("is strictly after now, even when now is exactly a run time", () => {
    const now = Date.UTC(2026, 10, 9, 9, 0, 0);
    expect(runs("0 9 * * *", { now, count: 1 })).toEqual(["2026-11-10T09:00:00Z"]);
  });

  it("steps", () => {
    expect(runs("*/5 * * * *", { count: 3 })).toEqual([
      "2026-11-09T10:20:00Z",
      "2026-11-09T10:25:00Z",
      "2026-11-09T10:30:00Z",
    ]);
    expect(runs("0 8-18/2 * * *")).toEqual([
      "2026-11-09T12:00:00Z",
      "2026-11-09T14:00:00Z",
      "2026-11-09T16:00:00Z",
      "2026-11-09T18:00:00Z",
      "2026-11-10T08:00:00Z",
    ]);
  });

  it("weekdays only", () => {
    // Friday 13 → Monday 16 skips the weekend.
    expect(runs("0 9 * * 1-5")).toEqual([
      "2026-11-10T09:00:00Z",
      "2026-11-11T09:00:00Z",
      "2026-11-12T09:00:00Z",
      "2026-11-13T09:00:00Z",
      "2026-11-16T09:00:00Z",
    ]);
  });

  it("crosses month and year boundaries", () => {
    expect(runs("30 4 1,15 * *")).toEqual([
      "2026-11-15T04:30:00Z",
      "2026-12-01T04:30:00Z",
      "2026-12-15T04:30:00Z",
      "2027-01-01T04:30:00Z",
      "2027-01-15T04:30:00Z",
    ]);
    expect(runs("@yearly", { count: 2 })).toEqual(["2027-01-01T00:00:00Z", "2028-01-01T00:00:00Z"]);
  });

  it("skips months too short for the day", () => {
    expect(runs("0 0 31 * *", { count: 4 })).toEqual([
      "2026-12-31T00:00:00Z",
      "2027-01-31T00:00:00Z",
      "2027-03-31T00:00:00Z",
      "2027-05-31T00:00:00Z",
    ]);
  });

  it("finds Feb 29 in leap years only, across the 2100 non-leap year", () => {
    expect(runs("0 0 29 2 *", { count: 3 })).toEqual([
      "2028-02-29T00:00:00Z",
      "2032-02-29T00:00:00Z",
      "2036-02-29T00:00:00Z",
    ]);
    const now = Date.UTC(2097, 0, 1);
    expect(runs("0 0 29 2 *", { now, count: 1 })).toEqual(["2104-02-29T00:00:00Z"]);
  });

  it("returns no runs for impossible dates, quickly", () => {
    const started = Date.now();
    expect(runs("0 0 30 2 *")).toEqual([]);
    expect(runs("0 0 31 4,6,9,11 *")).toEqual([]);
    expect(runs("0 0 31 2 * ")).toEqual([]);
    expect(Date.now() - started).toBeLessThan(500);
  });

  it("ORs day-of-month and day-of-week when both are restricted", () => {
    // Day 13 or any Friday.
    expect(runs("0 0 13 * 5")).toEqual([
      "2026-11-13T00:00:00Z",
      "2026-11-20T00:00:00Z",
      "2026-11-27T00:00:00Z",
      "2026-12-04T00:00:00Z",
      "2026-12-11T00:00:00Z",
    ]);
    // Day 1 or Monday: Feb 30 alone never runs, but the OR makes it run.
    expect(runs("0 0 30 2 1", { count: 2 })).toEqual(["2027-02-01T00:00:00Z", "2027-02-08T00:00:00Z"]);
  });

  it("ANDs the day fields when one starts with * (Vixie)", () => {
    // Odd days of the month that are Mondays.
    expect(runs("0 0 */2 * MON", { count: 3 })).toEqual([
      "2026-11-23T00:00:00Z",
      "2026-12-07T00:00:00Z",
      "2026-12-21T00:00:00Z",
    ]);
  });

  it("treats 7 as Sunday and ? as *", () => {
    expect(runs("0 0 * * 7", { count: 2 })).toEqual(["2026-11-15T00:00:00Z", "2026-11-22T00:00:00Z"]);
    expect(runs("0 0 ? * 0", { count: 2 })).toEqual(runs("0 0 * * 7", { count: 2 }));
  });

  it("handles month names and restricted months", () => {
    expect(runs("0 12 1 JAN,JUL *", { count: 3 })).toEqual([
      "2027-01-01T12:00:00Z",
      "2027-07-01T12:00:00Z",
      "2028-01-01T12:00:00Z",
    ]);
  });

  it("supports seconds", () => {
    expect(runs("*/20 * * * * *", { count: 4 })).toEqual([
      "2026-11-09T10:17:40Z",
      "2026-11-09T10:18:00Z",
      "2026-11-09T10:18:20Z",
      "2026-11-09T10:18:40Z",
    ]);
    expect(runs("15 30 9 * * *", { count: 1 })).toEqual(["2026-11-10T09:30:15Z"]);
  });

  it("rolls over at the end of a year", () => {
    const now = Date.UTC(2026, 11, 31, 23, 59, 30);
    expect(runs("* * * * *", { now, count: 2 })).toEqual(["2027-01-01T00:00:00Z", "2027-01-01T00:01:00Z"]);
  });

  it("honours count and returns nothing for @reboot", () => {
    expect(runs("* * * * *", { count: 1 })).toHaveLength(1);
    expect(runs("* * * * *", { count: 12 })).toHaveLength(12);
    expect(nextRuns(parseCron("@reboot"), { now: NOW })).toEqual([]);
  });

  it("accepts Date as now", () => {
    expect(runs("0 0 * * *", { now: new Date(NOW), count: 1 })).toEqual(["2026-11-10T00:00:00Z"]);
  });
});

describe("nextRuns (local time, fixed TZ)", () => {
  const original = process.env.TZ;
  afterEach(() => {
    process.env.TZ = original;
  });

  it("computes wall-clock times in the local zone", () => {
    process.env.TZ = "Europe/Istanbul"; // UTC+3, no DST
    const r = nextRuns(parseCron("0 9 * * *"), { now: NOW, count: 2 });
    expect(iso(r)).toEqual(["2026-11-10T06:00:00Z", "2026-11-11T06:00:00Z"]);
  });

  it("skips wall-clock times that don't exist when the clock springs forward", () => {
    process.env.TZ = "America/New_York"; // DST starts 2026-03-08 02:00 → 03:00
    const now = Date.UTC(2026, 2, 7, 12);
    const r = nextRuns(parseCron("30 2 * * *"), { now, count: 2 });
    expect(iso(r)).toEqual(["2026-03-09T06:30:00Z", "2026-03-10T06:30:00Z"]);
  });

  it("runs a repeated wall-clock time once when the clock falls back", () => {
    process.env.TZ = "America/New_York"; // DST ends 2026-11-01 02:00 → 01:00
    const now = Date.UTC(2026, 9, 31, 12);
    const r = nextRuns(parseCron("30 1 * * *"), { now, count: 2 });
    expect(iso(r)).toEqual(["2026-11-01T05:30:00Z", "2026-11-02T06:30:00Z"]);
  });

  it("keeps hourly runs strictly increasing across the fall-back hour", () => {
    process.env.TZ = "America/New_York";
    const now = Date.UTC(2026, 10, 1, 3); // 23:00 EDT on Oct 31
    const r = nextRuns(parseCron("0 * * * *"), { now, count: 5 }).map((x) => x.getTime());
    for (let i = 1; i < r.length; i += 1) expect(r[i]).toBeGreaterThan(r[i - 1]);
  });
});
