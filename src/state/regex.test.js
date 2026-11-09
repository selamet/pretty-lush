import { describe, it, expect } from "vitest";
import { DEFAULT_REGEX_STATE, loadRegexState } from "./regex.js";
import { STORAGE_KEYS } from "./storage.js";
import { fakeStorage, throwingStorage } from "../test/fake-storage.js";
import { SAMPLES } from "../languages/registry.js";
import { buildMatchModel } from "../regex/core.js";

describe("loadRegexState", () => {
  it("falls back to the default pattern", () => {
    expect(loadRegexState(fakeStorage())).toEqual(DEFAULT_REGEX_STATE);
    expect(loadRegexState(throwingStorage)).toEqual(DEFAULT_REGEX_STATE);
    expect(loadRegexState(null)).toEqual(DEFAULT_REGEX_STATE);
    expect(loadRegexState(fakeStorage({ [STORAGE_KEYS.regex]: "nope" }))).toEqual(DEFAULT_REGEX_STATE);
  });

  it("restores pattern, flags and replacement, normalizing flags", () => {
    const s = fakeStorage({
      [STORAGE_KEYS.regex]: JSON.stringify({ pattern: "", flags: "yigq", replacement: "" }),
    });
    expect(loadRegexState(s)).toEqual({ pattern: "", flags: "giy", replacement: "" });
  });

  it("ignores fields of the wrong type", () => {
    const s = fakeStorage({ [STORAGE_KEYS.regex]: JSON.stringify({ pattern: 1, flags: [], replacement: null }) });
    expect(loadRegexState(s)).toEqual(DEFAULT_REGEX_STATE);
  });

  it("ships a default pattern that matches the JSON, YAML and Python samples", () => {
    for (const lang of ["json", "yaml", "python"]) {
      const model = buildMatchModel({ ...DEFAULT_REGEX_STATE, text: SAMPLES[lang] });
      expect(model.status).toBe("ok");
      expect(model.matches.length).toBeGreaterThan(0);
    }
  });
});
