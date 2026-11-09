import { describe, expect, it } from "vitest";
import { toLowerCase, toTitleCase, toUpperCase } from "./case.js";

describe("case transforms", () => {
  it("upper- and lower-cases text", () => {
    expect(toUpperCase("Hello, world")).toBe("HELLO, WORLD");
    expect(toLowerCase("Hello, WORLD")).toBe("hello, world");
  });

  it("title-cases each word and lowercases the rest", () => {
    expect(toTitleCase("the QUICK brown fox")).toBe("The Quick Brown Fox");
  });

  it("keeps apostrophes inside words and treats hyphens as word breaks", () => {
    expect(toTitleCase("don't stop rock-n-roll")).toBe("Don't Stop Rock-N-Roll");
  });

  it("returns empty input unchanged", () => {
    expect(toTitleCase("")).toBe("");
    expect(toUpperCase("")).toBe("");
  });
});
