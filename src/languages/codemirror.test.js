import { describe, expect, it } from "vitest";
import { LANGUAGES } from "./registry.js";
import { LANG_LOADERS, getLoadedLanguage, loadLanguage } from "./codemirror.js";

describe("CodeMirror language loaders", () => {
  it("has a lazy loader for every registered language", () => {
    for (const { id } of LANGUAGES) {
      expect(typeof LANG_LOADERS[id], id).toBe("function");
    }
  });

  it("resolves null for unknown languages", async () => {
    await expect(loadLanguage("brainfuck")).resolves.toBeNull();
    expect(getLoadedLanguage("brainfuck")).toBeNull();
  });

  it("is not loaded until requested, then cached synchronously", async () => {
    expect(getLoadedLanguage("json")).toBeNull();
    const ext = await loadLanguage("json");
    expect(ext).toBeTruthy();
    expect(getLoadedLanguage("json")).toBe(ext);
    await expect(loadLanguage("json")).resolves.toBe(ext);
  });

  it("dedupes concurrent loads of the same language", async () => {
    const [a, b] = await Promise.all([loadLanguage("yaml"), loadLanguage("yaml")]);
    expect(a).toBeTruthy();
    expect(a).toBe(b);
  });

  it("loads every registered language pack", async () => {
    for (const { id } of LANGUAGES) {
      expect(await loadLanguage(id), id).toBeTruthy();
    }
  });
});
