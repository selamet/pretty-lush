import { describe, it, expect } from "vitest";
import {
  explainCron,
  extractCron,
  pickCronExpression,
  formatRelative,
  CRON_PRESETS,
  DEFAULT_CRON,
} from "./index.js";

const NOW = Date.UTC(2026, 10, 9, 10, 17, 23);

describe("explainCron", () => {
  it("returns description, field breakdown and runs", () => {
    const r = explainCron("0 9 * * 1-5", { now: NOW, utc: true, count: 2 });
    expect(r.ok).toBe(true);
    expect(r.description).toBe("At 09:00 on Monday through Friday");
    expect(r.never).toBe(false);
    expect(r.runs.map((d) => d.toISOString())).toEqual([
      "2026-11-10T09:00:00.000Z",
      "2026-11-11T09:00:00.000Z",
    ]);
    expect(r.fields.map((f) => [f.id, f.raw, f.summary])).toEqual([
      ["minute", "0", "0"],
      ["hour", "9", "9"],
      ["dom", "*", "every"],
      ["month", "*", "every"],
      ["dow", "1-5", "Mon–Fri"],
    ]);
  });

  it("includes the seconds row for 6-field expressions", () => {
    const r = explainCron("*/30 * * * * *", { now: NOW, utc: true });
    expect(r.hasSeconds).toBe(true);
    expect(r.fields[0]).toMatchObject({ id: "second", summary: "0, 30" });
  });

  it("flags schedules that never run", () => {
    const r = explainCron("0 0 30 2 *", { now: NOW, utc: true });
    expect(r).toMatchObject({ ok: true, never: true, runs: [] });
  });

  it("explains @reboot without runs", () => {
    expect(explainCron("@reboot")).toMatchObject({
      ok: true,
      reboot: true,
      description: "At startup",
      runs: [],
      fields: [],
      never: false,
    });
  });

  it("returns parse errors instead of throwing", () => {
    expect(explainCron("0 0 L * *")).toMatchObject({ ok: false, error: expect.stringMatching(/not supported/) });
    expect(explainCron("")).toMatchObject({ ok: false });
  });

  it("every preset parses", () => {
    for (const p of CRON_PRESETS) {
      const r = explainCron(p.expression, { now: NOW, utc: true });
      expect(r.ok, p.expression).toBe(true);
      expect(r.runs).toHaveLength(5);
    }
  });
});

describe("extractCron", () => {
  it("finds 5 / 6 fields and macros at the start of a line", () => {
    expect(extractCron("*/5 * * * *")).toBe("*/5 * * * *");
    expect(extractCron("  0 9 * * 1-5  ")).toBe("0 9 * * 1-5");
    expect(extractCron("*/10 * * * * *")).toBe("*/10 * * * * *");
    expect(extractCron("@daily")).toBe("@daily");
    expect(extractCron("@reboot /usr/bin/start")).toBe("@reboot");
  });

  it("ignores a crontab line's command", () => {
    expect(extractCron("0 3 * * * /usr/local/bin/backup.sh --full")).toBe("0 3 * * *");
    expect(extractCron("0 9 * * 1 echo hi")).toBe("0 9 * * 1");
    expect(extractCron("30 2 * * * root run-parts /etc/cron.daily")).toBe("30 2 * * *");
  });

  it("rejects prose, comments and code", () => {
    expect(extractCron("")).toBeNull();
    expect(extractCron("# m h dom mon dow command")).toBeNull();
    expect(extractCron("hello world this is text")).toBeNull();
    expect(extractCron("const x = 1;")).toBeNull();
    expect(extractCron("@foo")).toBeNull();
    expect(extractCron("1 2 3")).toBeNull();
  });
});

describe("pickCronExpression", () => {
  it("prefers the selection, then the cursor line, then the input", () => {
    const input = "# crontab\n0 3 * * * backup\n*/5 * * * * poll";
    expect(pickCronExpression({ selection: "0 9 * * 1-5", cursorLine: "*/5 * * * * poll", input })).toBe("0 9 * * 1-5");
    expect(pickCronExpression({ selection: "", cursorLine: "*/5 * * * * poll", input })).toBe("*/5 * * * *");
    expect(pickCronExpression({ cursorLine: "# crontab", input })).toBe("0 3 * * *");
  });

  it("scans a multi-line selection", () => {
    expect(pickCronExpression({ selection: "# jobs\n@hourly ping" })).toBe("@hourly");
  });

  it("falls back to the default", () => {
    expect(pickCronExpression({ input: "{\"a\": 1}" })).toBe(DEFAULT_CRON);
    expect(pickCronExpression()).toBe(DEFAULT_CRON);
  });
});

describe("formatRelative", () => {
  const at = (sec) => new Date(NOW + sec * 1000);
  it("formats the distance from now", () => {
    expect(formatRelative(at(37), NOW)).toBe("in 37 s");
    expect(formatRelative(at(-5), NOW)).toBe("in 0 s");
    expect(formatRelative(at(12 * 60 + 5), NOW)).toBe("in 12 min");
    expect(formatRelative(at(3 * 3600), NOW)).toBe("in 3 h");
    expect(formatRelative(at(3 * 3600 + 5 * 60), NOW)).toBe("in 3 h 5 min");
    expect(formatRelative(at(86400), NOW)).toBe("in 1 day");
    expect(formatRelative(at(10 * 86400), new Date(NOW))).toBe("in 10 days");
    expect(formatRelative(at(800 * 86400), NOW)).toBe("in 2 years");
  });
});
