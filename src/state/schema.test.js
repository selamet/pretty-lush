import { describe, it, expect } from "vitest";
import { DEFAULT_SCHEMA_STATE, SAMPLE_SCHEMA, loadSchemaState } from "./schema.js";
import { STORAGE_KEYS } from "./storage.js";
import { fakeStorage, throwingStorage } from "../test/fake-storage.js";
import { SAMPLES } from "../languages/registry.js";
import { validateJson } from "../schema/validate.js";

describe("loadSchemaState", () => {
  it("defaults to a closed panel with the sample schema", () => {
    expect(loadSchemaState(fakeStorage())).toEqual(DEFAULT_SCHEMA_STATE);
    expect(loadSchemaState(throwingStorage)).toEqual(DEFAULT_SCHEMA_STATE);
    expect(loadSchemaState(null)).toEqual(DEFAULT_SCHEMA_STATE);
  });

  it("restores the stored schema text and open flag", () => {
    const s = fakeStorage({ [STORAGE_KEYS.schema]: JSON.stringify({ open: true, text: "{}" }) });
    expect(loadSchemaState(s)).toEqual({ open: true, text: "{}" });
  });

  it("keeps an emptied schema and ignores fields of the wrong type", () => {
    const s1 = fakeStorage({ [STORAGE_KEYS.schema]: JSON.stringify({ open: true, text: "" }) });
    expect(loadSchemaState(s1).text).toBe("");
    const s2 = fakeStorage({ [STORAGE_KEYS.schema]: JSON.stringify({ open: "yes", text: 5 }) });
    expect(loadSchemaState(s2)).toEqual(DEFAULT_SCHEMA_STATE);
    const s3 = fakeStorage({ [STORAGE_KEYS.schema]: "not json" });
    expect(loadSchemaState(s3)).toEqual(DEFAULT_SCHEMA_STATE);
  });

  it("ships a sample schema the JSON sample validates against", async () => {
    expect(await validateJson(SAMPLES.json, SAMPLE_SCHEMA)).toEqual({
      status: "valid",
      dialect: "2020-12",
    });
  });
});
