import { describe, it, expect } from "vitest";
import { DEFAULT_SETTINGS, loadSettings } from "./settings.js";
import { STORAGE_KEYS } from "./storage.js";
import { fakeStorage, throwingStorage } from "../test/fake-storage.js";

const light = () => false;
const dark = () => true;

describe("loadSettings", () => {
  it("keeps the historical localStorage keys", () => {
    expect(STORAGE_KEYS).toEqual({
      workspace: "pretty-lush:state:v1",
      layout: "pretty-lush:layout:v1",
      theme: "pretty-lush:theme",
      settings: "pretty-lush:settings:v1",
      history: "pretty-lush:history:v1",
      compare: "pretty-lush:compare:v1",
    });
  });

  it("returns defaults when nothing is stored and the OS is light", () => {
    expect(loadSettings(fakeStorage(), light)).toEqual(DEFAULT_SETTINGS);
  });

  it("picks the dark editor theme when the OS prefers dark", () => {
    expect(loadSettings(fakeStorage(), dark).editorTheme).toBe("pretty-lush-dark");
  });

  it("migrates the legacy light/dark theme key before consulting the OS", () => {
    const s1 = fakeStorage({ [STORAGE_KEYS.theme]: "dark" });
    expect(loadSettings(s1, light).editorTheme).toBe("pretty-lush-dark");
    const s2 = fakeStorage({ [STORAGE_KEYS.theme]: "light" });
    expect(loadSettings(s2, dark).editorTheme).toBe("pretty-lush-light");
  });

  it("merges stored settings over the defaults", () => {
    const storage = fakeStorage({
      [STORAGE_KEYS.settings]: JSON.stringify({ indent: "tab", lineWidth: 120 }),
    });
    expect(loadSettings(storage, light)).toEqual({
      ...DEFAULT_SETTINGS,
      indent: "tab",
      lineWidth: 120,
    });
  });

  it("keeps Ruff lint off by default and restores it when stored", () => {
    expect(loadSettings(fakeStorage(), light).lint).toBe(false);
    const storage = fakeStorage({
      [STORAGE_KEYS.settings]: JSON.stringify({ lint: true }),
    });
    expect(loadSettings(storage, light).lint).toBe(true);
  });

  it("stored editor theme wins over the migrated one", () => {
    const storage = fakeStorage({
      [STORAGE_KEYS.theme]: "dark",
      [STORAGE_KEYS.settings]: JSON.stringify({ editorTheme: "dracula" }),
    });
    expect(loadSettings(storage, light).editorTheme).toBe("dracula");
  });

  it("falls back to defaults on corrupt JSON or unavailable storage", () => {
    const corrupt = fakeStorage({ [STORAGE_KEYS.settings]: "{nope" });
    expect(loadSettings(corrupt, light)).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(throwingStorage, light)).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(null, dark).editorTheme).toBe("pretty-lush-dark");
  });
});
