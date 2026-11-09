import { describe, it, expect } from "vitest";
import {
  DEFAULT_LANG,
  MAX_INPUT_BYTES,
  loadCompare,
  loadWorkspace,
  serializeWorkspace,
} from "./workspace.js";
import { STORAGE_KEYS } from "./storage.js";
import { SAMPLES } from "../languages/registry.js";
import { fakeStorage, throwingStorage } from "../test/fake-storage.js";

const stored = (key, v) => fakeStorage({ [key]: JSON.stringify(v) });

describe("loadWorkspace", () => {
  it("defaults to python with the built-in samples", () => {
    expect(loadWorkspace(fakeStorage())).toEqual({ lang: DEFAULT_LANG, inputs: SAMPLES });
    expect(loadWorkspace(throwingStorage)).toEqual({ lang: DEFAULT_LANG, inputs: SAMPLES });
  });

  it("restores the language and layers inputs over samples", () => {
    const ws = loadWorkspace(
      stored(STORAGE_KEYS.workspace, { lang: "json", inputs: { json: "[1]" } })
    );
    expect(ws.lang).toBe("json");
    expect(ws.inputs.json).toBe("[1]");
    expect(ws.inputs.python).toBe(SAMPLES.python);
  });

  it("ignores unknown languages and malformed shapes", () => {
    expect(loadWorkspace(stored(STORAGE_KEYS.workspace, { lang: "cobol" })).lang).toBe(DEFAULT_LANG);
    expect(loadWorkspace(stored(STORAGE_KEYS.workspace, { inputs: "x" })).inputs).toEqual(SAMPLES);
    expect(loadWorkspace(stored(STORAGE_KEYS.workspace, null)).lang).toBe(DEFAULT_LANG);
  });
});

describe("serializeWorkspace", () => {
  it("drops oversized inputs and normalizes empty ones", () => {
    const big = "x".repeat(MAX_INPUT_BYTES + 1);
    expect(serializeWorkspace("json", { json: "{}", yaml: big, css: undefined })).toEqual({
      lang: "json",
      inputs: { json: "{}", css: "" },
    });
  });
});

describe("loadCompare", () => {
  it("reads both bodies with safe fallbacks", () => {
    expect(loadCompare(stored(STORAGE_KEYS.compare, { a: "1", b: "2" }))).toEqual({ a: "1", b: "2" });
    expect(loadCompare(stored(STORAGE_KEYS.compare, { a: "1" }))).toEqual({ a: "1", b: "" });
    expect(loadCompare(fakeStorage({ [STORAGE_KEYS.compare]: "bad" }))).toEqual({ a: "", b: "" });
    expect(loadCompare(throwingStorage)).toEqual({ a: "", b: "" });
  });
});
