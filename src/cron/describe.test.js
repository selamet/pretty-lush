import { describe, it, expect } from "vitest";
import { parseCron } from "./parse.js";
import { describeCron, summarizeField, ordinal, joinList } from "./describe.js";

const d = (expr) => describeCron(parseCron(expr));

describe("describeCron", () => {
  it.each([
    ["* * * * *", "Every minute"],
    ["*/5 * * * *", "Every 5 minutes"],
    ["0 * * * *", "Every hour"],
    ["0 */2 * * *", "Every 2 hours"],
    ["15 * * * *", "At minute 15 past every hour"],
    ["0,30 * * * *", "At minutes 0 and 30 past every hour"],
    ["0 0 * * *", "At 00:00"],
    ["0 9 * * 1-5", "At 09:00 on Monday through Friday"],
    ["0 9,17 * * *", "At 09:00 and 17:00"],
    ["0,30 9 * * *", "At 09:00 and 09:30"],
    ["0 8-18/2 * * *", "At minute 0 past every 2nd hour from 8 through 18"],
    ["0 9-17 * * *", "At minute 0 past every hour from 9 through 17"],
    ["*/15 9-17 * * *", "Every 15 minutes from 09:00 through 17:45"],
    ["* 9 * * *", "Every minute from 09:00 through 09:59"],
    ["5/15 * * * *", "Every 15th minute from 5 through 59 past every hour"],
    ["10-20 * * * *", "Every minute from 10 through 20 past every hour"],
    ["30 4 1,15 * *", "At 04:30 on days 1 and 15 of the month"],
    ["0 0 1 1 *", "At 00:00 on day 1 of the month in January"],
    ["0 0 1-7 * *", "At 00:00 on days 1 through 7 of the month"],
    ["0 0 */2 * *", "At 00:00 on every 2nd day of the month"],
    ["0 0 1 */3 *", "At 00:00 on day 1 of the month in every 3rd month"],
    ["0 12 * JAN-MAR,JUL MON-FRI", "At 12:00 on Monday through Friday in January through March and July"],
    ["0 0 * * 1,3,5", "At 00:00 on Monday, Wednesday and Friday"],
    ["0 0 * * 7", "At 00:00 on Sunday"],
    ["0 0 * * */2", "At 00:00 on Sunday, Tuesday, Thursday and Saturday"],
    ["0 0 ? * MON", "At 00:00 on Monday"],
  ])("%s → %s", (expr, text) => {
    expect(d(expr)).toBe(text);
  });

  it("uses OR wording when both day fields are restricted", () => {
    expect(d("0 0 13 * 5")).toBe("At 00:00 on day 13 of the month or on Friday");
  });

  it("uses AND wording when a day field starts with * (Vixie rule)", () => {
    expect(d("0 0 */2 * MON")).toBe("At 00:00 on every 2nd day of the month, if it is Monday");
    expect(d("0 0 1 * */3")).toBe("At 00:00 on day 1 of the month, if it is Sunday, Wednesday or Saturday");
  });

  it("describes 6-field expressions with seconds", () => {
    expect(d("* * * * * *")).toBe("Every second");
    expect(d("*/10 * * * * *")).toBe("Every 10 seconds");
    expect(d("30 * * * * *")).toBe("At second 30 past every minute");
    expect(d("0 0 9 * * *")).toBe("At 09:00");
    expect(d("15 30 9 * * *")).toBe("At 09:30:15");
    expect(d("0 0 * * * *")).toBe("Every hour");
    expect(d("*/10 5 * * * *")).toBe("Every 10 seconds past minute 5 past every hour");
  });

  it("describes macros and @reboot", () => {
    expect(d("@daily")).toBe("At 00:00");
    expect(d("@hourly")).toBe("Every hour");
    expect(d("@weekly")).toBe("At 00:00 on Sunday");
    expect(d("@monthly")).toBe("At 00:00 on day 1 of the month");
    expect(d("@yearly")).toBe("At 00:00 on day 1 of the month in January");
    expect(d("@reboot")).toBe("At startup");
  });

  it("mixes singles, ranges and steps in one field", () => {
    expect(d("1-5,10,20-30/5 * * * *")).toBe(
      "At every minute from 1 through 5, minute 10 and every 5th minute from 20 through 30 past every hour"
    );
  });
});

describe("summarizeField", () => {
  const s = (expr, id) => summarizeField(parseCron(expr).fields[id]);

  it("summarizes values compactly", () => {
    expect(s("* * * * *", "minute")).toBe("every");
    expect(s("*/15 * * * *", "minute")).toBe("0, 15, 30, 45");
    expect(s("1-5,10 * * * *", "minute")).toBe("1–5, 10");
    expect(s("1,2 * * * *", "minute")).toBe("1, 2");
    expect(s("0 0 * * 1-5", "dow")).toBe("Mon–Fri");
    expect(s("0 0 * * 0-7", "dow")).toBe("every");
    expect(s("0 0 * jan,mar *", "month")).toBe("Jan, Mar");
  });
});

describe("helpers", () => {
  it("ordinal", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "101st", "111th",
    ]);
  });

  it("joinList", () => {
    expect(joinList([])).toBe("");
    expect(joinList(["a"])).toBe("a");
    expect(joinList(["a", "b"])).toBe("a and b");
    expect(joinList(["a", "b", "c"], "or")).toBe("a, b or c");
  });
});
