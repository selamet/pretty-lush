import { describe, it, expect } from "vitest";
import { parseCron, CronError } from "./parse.js";

const values = (expr, id) => parseCron(expr).fields[id].values;

describe("parseCron", () => {
  it("parses 5-field expressions with an implicit second 0", () => {
    const p = parseCron("5 4 * * *");
    expect(p.hasSeconds).toBe(false);
    expect(p.macro).toBeNull();
    expect(p.fields.second.values).toEqual([0]);
    expect(p.fields.minute.values).toEqual([5]);
    expect(p.fields.hour.values).toEqual([4]);
    expect(p.fields.dom.values).toHaveLength(31);
    expect(p.fields.month.values).toHaveLength(12);
    expect(p.fields.dow.values).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("parses 6-field expressions with a leading seconds field", () => {
    const p = parseCron("*/15 0 9 * * *");
    expect(p.hasSeconds).toBe(true);
    expect(p.fields.second.values).toEqual([0, 15, 30, 45]);
    expect(p.fields.minute.values).toEqual([0]);
    expect(p.fields.hour.values).toEqual([9]);
  });

  it("trims and accepts any whitespace between fields", () => {
    expect(parseCron("  0\t9  * *\t*  ").expression).toBe("0\t9  * *\t*");
    expect(values(" 0  9 * * * ", "hour")).toEqual([9]);
  });

  it("expands lists, ranges and steps", () => {
    expect(values("1,2,30 * * * *", "minute")).toEqual([1, 2, 30]);
    expect(values("10-14 * * * *", "minute")).toEqual([10, 11, 12, 13, 14]);
    expect(values("*/20 * * * *", "minute")).toEqual([0, 20, 40]);
    expect(values("1-10/3 * * * *", "minute")).toEqual([1, 4, 7, 10]);
    expect(values("50/4 * * * *", "minute")).toEqual([50, 54, 58]);
    expect(values("0 1-3,20-23/2 * * *", "hour")).toEqual([1, 2, 3, 20, 22]);
    expect(values("0 0 */10 * *", "dom")).toEqual([1, 11, 21, 31]);
    expect(values("0 0 1 */4 *", "month")).toEqual([1, 5, 9]);
  });

  it("dedupes and sorts overlapping parts", () => {
    expect(values("30,0-10/5,5 * * * *", "minute")).toEqual([0, 5, 10, 30]);
  });

  it("accepts month and weekday names in any case", () => {
    expect(values("0 0 1 JAN,jul,Dec *", "month")).toEqual([1, 7, 12]);
    expect(values("0 0 1 feb-apr *", "month")).toEqual([2, 3, 4]);
    expect(values("0 0 * * MON-FRI", "dow")).toEqual([1, 2, 3, 4, 5]);
    expect(values("0 0 * * sun,Sat", "dow")).toEqual([0, 6]);
  });

  it("treats day-of-week 7 as Sunday", () => {
    expect(values("0 0 * * 7", "dow")).toEqual([0]);
    expect(values("0 0 * * 5-7", "dow")).toEqual([0, 5, 6]);
    expect(values("0 0 * * 0-7", "dow")).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(values("0 0 * * */2", "dow")).toEqual([0, 2, 4, 6]);
  });

  it("treats ? like * in the day fields", () => {
    const p = parseCron("0 0 ? * MON");
    expect(p.fields.dom.values).toHaveLength(31);
    expect(p.fields.dom.star).toBe(true);
    expect(parseCron("0 0 1 * ?").fields.dow.star).toBe(true);
  });

  it("marks fields that start with * as star (Vixie day-field rule)", () => {
    const p = parseCron("0 0 */2 * 1");
    expect(p.fields.dom.star).toBe(true);
    expect(p.fields.dow.star).toBe(false);
  });

  it("expands macros", () => {
    const cases = {
      "@yearly": "0 0 1 1 *",
      "@annually": "0 0 1 1 *",
      "@monthly": "0 0 1 * *",
      "@weekly": "0 0 * * 0",
      "@daily": "0 0 * * *",
      "@midnight": "0 0 * * *",
      "@hourly": "0 * * * *",
    };
    for (const [macro, expanded] of Object.entries(cases)) {
      const p = parseCron(macro);
      expect(p.macro).toBe(macro);
      expect(p.fields).toEqual(parseCron(expanded).fields);
    }
    expect(parseCron("@DAILY").macro).toBe("@daily");
  });

  it("parses @reboot without fields", () => {
    expect(parseCron("@reboot")).toMatchObject({ reboot: true, fields: null, macro: "@reboot" });
  });

  describe("errors", () => {
    const fails = (expr, msg) => {
      expect(() => parseCron(expr)).toThrow(CronError);
      expect(() => parseCron(expr)).toThrow(msg);
    };

    it("rejects empty input and wrong field counts", () => {
      fails("", /Enter a cron expression/);
      fails("   ", /Enter a cron expression/);
      fails("* * * *", /got 4/);
      fails("* * * * * * * *", /got 8/);
      fails("0 0 12 * * ? 2027", /Quartz year field/);
      fails("0 0 1 1 * 2027", /Quartz year field/);
    });

    it("rejects unknown macros", () => {
      fails("@fortnightly", /Unknown macro/);
    });

    it("rejects out-of-range values", () => {
      fails("60 * * * *", /Minute: 60 is out of range \(0–59\)/);
      fails("0 24 * * *", /Hour: 24/);
      fails("0 0 0 * *", /Day of month: 0/);
      fails("0 0 32 * *", /Day of month: 32/);
      fails("0 0 1 13 *", /Month: 13/);
      fails("0 0 * * 8", /Day of week: 8/);
      fails("60 * * * * *", /Second: 60/);
    });

    it("rejects malformed values, ranges and steps", () => {
      fails("abc * * * *", /Minute: "abc" is not a valid value/);
      fails("0 0 * FOO *", /Month: "FOO"/);
      fails("0 0 * * MONDAY", /Day of week: "MONDAY"/);
      fails("1,,2 * * * *", /empty list item/);
      fails("1- * * * *", /not a valid range/);
      fails("1-2-3 * * * *", /not a valid range/);
      fails("*/0 * * * *", /step "0" must be a positive whole number/);
      fails("*/x * * * *", /step "x"/);
      fails("*/2/3 * * * *", /more than one "\/"/);
      fails("0 22-2 * * *", /range 22-2 goes backwards/);
      fails("? * * * *", /only allowed in the day-of-month and day-of-week/);
    });

    it("rejects Quartz L / W / # with a clear message", () => {
      fails("0 0 L * *", /"L" \/ "W".*not supported/);
      fails("0 0 15W * *", /not supported/);
      fails("0 0 LW * *", /not supported/);
      fails("0 0 * * 5L", /not supported/);
      fails("0 0 * * FRI#3", /"#".*not supported/);
      fails("0 0 * * 5#3", /"#"/);
    });

    it("does not mistake weekday / month names for L / W", () => {
      expect(() => parseCron("0 0 * JUL WED")).not.toThrow();
      expect(() => parseCron("0 0 * * MON-WED")).not.toThrow();
    });
  });
});
