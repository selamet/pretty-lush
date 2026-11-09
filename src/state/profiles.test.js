import { describe, it, expect } from "vitest";
import {
  DEFAULT_PROFILE,
  MAX_PROFILES,
  MAX_PROFILE_NAME,
  applyProfileSettings,
  createProfilesState,
  deleteProfile,
  getActiveProfile,
  loadProfiles,
  normalizeProfileName,
  pickProfileSettings,
  profileNameError,
  renameProfile,
  sanitizeProfiles,
  saveProfile,
  switchProfile,
  syncActiveProfile,
} from "./profiles.js";
import { DEFAULT_SETTINGS, FORMAT_SETTING_KEYS } from "./settings.js";
import { STORAGE_KEYS } from "./storage.js";
import { fakeStorage, throwingStorage } from "../test/fake-storage.js";

const live = { ...DEFAULT_SETTINGS, indent: 4, editorTheme: "dracula", lint: true };

function withWork() {
  return saveProfile(createProfilesState(live), "Work", { ...live, semi: false });
}

describe("pickProfileSettings", () => {
  it("keeps only formatter options and fills defaults", () => {
    const picked = pickProfileSettings({ indent: "tab", editorTheme: "x", autoFormat: true });
    expect(Object.keys(picked).sort()).toEqual([...FORMAT_SETTING_KEYS].sort());
    expect(picked.indent).toBe("tab");
    expect(picked.lineWidth).toBe(DEFAULT_SETTINGS.lineWidth);
    expect(picked).not.toHaveProperty("editorTheme");
  });

  it("tolerates garbage", () => {
    expect(pickProfileSettings(null)).toEqual(pickProfileSettings({}));
  });
});

describe("loadProfiles", () => {
  it("migrates the current settings into Default when nothing is stored", () => {
    const state = loadProfiles(fakeStorage(), live);
    expect(state.active).toBe(DEFAULT_PROFILE);
    expect(state.profiles).toHaveLength(1);
    expect(state.profiles[0]).toEqual({ name: "Default", settings: pickProfileSettings(live) });
  });

  it("restores stored profiles and the active one", () => {
    const stored = withWork();
    const storage = fakeStorage({ [STORAGE_KEYS.profiles]: JSON.stringify(stored) });
    expect(loadProfiles(storage, DEFAULT_SETTINGS)).toEqual(stored);
  });

  it("falls back to a fresh state on corrupt JSON or blocked storage", () => {
    const corrupt = fakeStorage({ [STORAGE_KEYS.profiles]: "{nope" });
    expect(loadProfiles(corrupt, live)).toEqual(createProfilesState(live));
    expect(loadProfiles(throwingStorage, live)).toEqual(createProfilesState(live));
    expect(loadProfiles(null, live)).toEqual(createProfilesState(live));
  });
});

describe("sanitizeProfiles", () => {
  it("drops malformed and duplicate entries, keeps Default first", () => {
    const state = sanitizeProfiles(
      {
        active: "work",
        profiles: [
          { name: "  Work  repo ", settings: { indent: 4 } },
          null,
          { name: "", settings: {} },
          { name: "x".repeat(MAX_PROFILE_NAME + 1) },
          { name: "work REPO", settings: {} },
          { name: "default", settings: { indent: "tab" } },
        ],
      },
      live
    );
    expect(state.profiles.map((p) => p.name)).toEqual(["Default", "Work repo"]);
    expect(state.profiles[0].settings.indent).toBe("tab");
    // Unknown active profile → Default.
    expect(state.active).toBe("Default");
  });

  it("adds a Default profile when missing", () => {
    const state = sanitizeProfiles({ active: "A", profiles: [{ name: "A", settings: {} }] }, live);
    expect(state.profiles.map((p) => p.name)).toEqual(["Default", "A"]);
    expect(state.profiles[0].settings.indent).toBe(4);
    expect(state.active).toBe("A");
  });

  it("rejects non-object data", () => {
    expect(sanitizeProfiles("nope", live)).toEqual(createProfilesState(live));
    expect(sanitizeProfiles({ profiles: "x" }, live)).toEqual(createProfilesState(live));
  });
});

describe("profile names", () => {
  it("normalizes whitespace", () => {
    expect(normalizeProfileName("  a \t b  ")).toBe("a b");
    expect(normalizeProfileName(undefined)).toBe("");
  });

  it("reports empty, too long and duplicate names", () => {
    const state = withWork();
    expect(profileNameError(state, "  ")).toMatch(/Enter a name/);
    expect(profileNameError(state, "x".repeat(MAX_PROFILE_NAME + 1))).toMatch(/at most/);
    expect(profileNameError(state, "work")).toMatch(/"Work" already exists/);
    expect(profileNameError(state, "DEFAULT")).toMatch(/already exists/);
    expect(profileNameError(state, "Other")).toBeNull();
    // A rename may re-case its own name.
    expect(profileNameError(state, "WORK", { except: "Work" })).toBeNull();
  });
});

describe("saveProfile", () => {
  it("adds a profile with the current formatter settings and activates it", () => {
    const state = withWork();
    expect(state.active).toBe("Work");
    expect(getActiveProfile(state).settings.semi).toBe(false);
    expect(state.profiles.map((p) => p.name)).toEqual(["Default", "Work"]);
  });

  it("throws on an invalid name or when the limit is reached", () => {
    expect(() => saveProfile(withWork(), "work", live)).toThrow(/already exists/);
    let state = createProfilesState(live);
    for (let i = 1; i < MAX_PROFILES; i++) state = saveProfile(state, `P${i}`, live);
    expect(() => saveProfile(state, "One more", live)).toThrow(/at most/);
  });
});

describe("switchProfile", () => {
  it("changes the active profile", () => {
    const state = switchProfile(withWork(), "Default");
    expect(state.active).toBe("Default");
  });

  it("returns the same state when already active and throws on unknown names", () => {
    const state = withWork();
    expect(switchProfile(state, "Work")).toBe(state);
    expect(() => switchProfile(state, "Nope")).toThrow(/No profile/);
  });
});

describe("renameProfile", () => {
  it("renames and keeps it active", () => {
    const state = renameProfile(withWork(), "Work", " Client  A ");
    expect(state.profiles.map((p) => p.name)).toEqual(["Default", "Client A"]);
    expect(state.active).toBe("Client A");
  });

  it("refuses Default, duplicates and unknown profiles", () => {
    const state = saveProfile(withWork(), "Other", live);
    expect(() => renameProfile(state, "Default", "X")).toThrow(/can't be renamed/);
    expect(() => renameProfile(state, "Other", "work")).toThrow(/already exists/);
    expect(() => renameProfile(state, "Nope", "X")).toThrow(/No profile/);
    expect(renameProfile(state, "Other", "Other")).toBe(state);
  });
});

describe("deleteProfile", () => {
  it("deleting the active profile activates Default", () => {
    const state = deleteProfile(withWork(), "Work");
    expect(state.profiles.map((p) => p.name)).toEqual(["Default"]);
    expect(state.active).toBe("Default");
  });

  it("keeps the active profile when another one is deleted", () => {
    const state = deleteProfile(saveProfile(withWork(), "Other", live), "Work");
    expect(state.active).toBe("Other");
  });

  it("refuses to delete Default", () => {
    expect(() => deleteProfile(withWork(), "Default")).toThrow(/can't be deleted/);
  });
});

describe("syncActiveProfile", () => {
  it("mirrors live formatter settings into the active profile only", () => {
    const state = withWork();
    const next = syncActiveProfile(state, { ...live, lineWidth: 120, editorTheme: "y" });
    expect(getActiveProfile(next).settings.lineWidth).toBe(120);
    expect(next.profiles[0]).toBe(state.profiles[0]);
  });

  it("returns the same object when nothing changed", () => {
    const state = withWork();
    const same = syncActiveProfile(state, { ...live, semi: false, editorTheme: "other" });
    expect(same).toBe(state);
  });
});

describe("applyProfileSettings", () => {
  it("writes the profile's formatter options over live settings", () => {
    const work = getActiveProfile(withWork());
    const next = applyProfileSettings({ ...DEFAULT_SETTINGS, editorTheme: "dracula" }, work);
    expect(next.semi).toBe(false);
    expect(next.indent).toBe(4);
    expect(next.editorTheme).toBe("dracula");
  });
});
