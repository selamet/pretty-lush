import { describe, it, expect } from "vitest";
import { filterLanguageGroups, getLanguage } from "./groups.js";
import { LANGUAGES } from "./registry.js";

describe("filterLanguageGroups", () => {
  it("lists every language exactly once without a filter", () => {
    const ids = filterLanguageGroups("").flatMap((g) => g.items.map((l) => l.id));
    expect(ids.sort()).toEqual(LANGUAGES.map((l) => l.id).sort());
  });

  it("filters by label or extension, case-insensitively, and drops empty groups", () => {
    const groups = filterLanguageGroups("  PYth ");
    expect(groups.flatMap((g) => g.items.map((l) => l.id))).toEqual(["python"]);
    expect(groups).toHaveLength(1);
    const byExt = filterLanguageGroups("yam").flatMap((g) => g.items.map((l) => l.id));
    expect(byExt).toContain("yaml");
    expect(filterLanguageGroups("zzzz")).toEqual([]);
  });
});

describe("getLanguage", () => {
  it("looks up registry entries", () => {
    expect(getLanguage("json").label).toBe("JSON");
    expect(getLanguage("nope")).toBeUndefined();
  });
});
