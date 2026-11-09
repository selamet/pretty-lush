import { describe, expect, it } from "vitest";
import { formatCode } from "./index.js";
import { SAMPLES } from "../languages/registry.js";

describe("formatCode('csv')", () => {
  it("normalises quoting and line endings without touching cell values", async () => {
    expect(await formatCode("csv", '"a","b"\r\n"1","x,y"\r\n"2"," pad"')).toBe(
      'a,b\n1,"x,y"\n2," pad"\n'
    );
  });

  it("keeps the sample stable", async () => {
    const once = await formatCode("csv", SAMPLES.csv);
    expect(await formatCode("csv", once)).toBe(once);
  });

  it("reports unterminated quotes", async () => {
    await expect(formatCode("csv", 'a\n"oops')).rejects.toThrow(/Unterminated/);
  });
});
