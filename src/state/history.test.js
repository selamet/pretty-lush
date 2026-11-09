import { describe, it, expect } from "vitest";
import {
  MAX_HISTORY,
  addHistoryEntry,
  createHistoryEntry,
  formatRelativeTime,
  loadHistory,
} from "./history.js";
import { STORAGE_KEYS } from "./storage.js";
import { fakeStorage, throwingStorage } from "../test/fake-storage.js";

describe("loadHistory", () => {
  it("returns stored arrays and [] for anything else", () => {
    const entries = [{ id: "1", lang: "json", input: "{}" }];
    expect(loadHistory(fakeStorage({ [STORAGE_KEYS.history]: JSON.stringify(entries) }))).toEqual(entries);
    expect(loadHistory(fakeStorage({ [STORAGE_KEYS.history]: '{"a":1}' }))).toEqual([]);
    expect(loadHistory(fakeStorage({ [STORAGE_KEYS.history]: "oops" }))).toEqual([]);
    expect(loadHistory(fakeStorage())).toEqual([]);
    expect(loadHistory(throwingStorage)).toEqual([]);
  });
});

describe("addHistoryEntry", () => {
  it("prepends and removes duplicates of the same lang + input", () => {
    const prev = [
      { id: "a", lang: "json", input: "{}" },
      { id: "b", lang: "yaml", input: "{}" },
    ];
    const next = addHistoryEntry(prev, { id: "c", lang: "json", input: "{}" });
    expect(next.map((e) => e.id)).toEqual(["c", "b"]);
  });

  it("caps the list", () => {
    const prev = Array.from({ length: MAX_HISTORY }, (_, i) => ({ id: String(i), lang: "x", input: String(i) }));
    const next = addHistoryEntry(prev, { id: "new", lang: "x", input: "new" });
    expect(next).toHaveLength(MAX_HISTORY);
    expect(next[0].id).toBe("new");
    expect(next.at(-1).id).toBe(String(MAX_HISTORY - 2));
  });
});

describe("createHistoryEntry", () => {
  it("builds a compact entry", () => {
    const entry = createHistoryEntry({
      lang: "json",
      input: '{\n  "a":   1\n}',
      output: '{ "a": 1 }',
      now: 1000,
      random: () => 0.5,
    });
    expect(entry).toEqual({
      id: "1000-i",
      ts: 1000,
      lang: "json",
      input: '{\n  "a":   1\n}',
      snippet: '{ "a": 1 }',
      inSize: 14,
      outSize: 10,
    });
  });

  it("truncates the snippet to 80 chars", () => {
    const entry = createHistoryEntry({ lang: "x", input: "a".repeat(200), output: "" });
    expect(entry.snippet).toHaveLength(80);
  });
});

describe("formatRelativeTime", () => {
  const now = 10_000_000_000;
  const ago = (sec) => formatRelativeTime(now - sec * 1000, now);
  it("renders coarse buckets", () => {
    expect(ago(10)).toBe("just now");
    expect(ago(60)).toBe("a minute ago");
    expect(ago(10 * 60)).toBe("10 min ago");
    expect(ago(60 * 60)).toBe("an hour ago");
    expect(ago(5 * 3600)).toBe("5 h ago");
    expect(ago(30 * 3600)).toBe("yesterday");
    expect(ago(5 * 86400)).toBe("5 d ago");
    expect(formatRelativeTime(now + 5000, now)).toBe("just now");
  });
});
