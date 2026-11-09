import { describe, expect, it } from "vitest";
import { formatDotenv } from "./dotenv.js";
import { FormatError } from "./errors.js";

describe("formatDotenv", () => {
  it("normalises spacing around '=' and keeps comments/exports", () => {
    const src = "# db\nDB_HOST = localhost\nexport   PORT=  5432\n";
    expect(formatDotenv(src)).toBe("# db\nDB_HOST=localhost\nexport PORT=5432\n");
  });

  it("collapses blank-line runs and trims leading/trailing blanks", () => {
    expect(formatDotenv("\n\nA=1\n\n\n\nB=2\n\n\n")).toBe("A=1\n\nB=2\n");
  });

  it("strips inline comments but keeps '#' in quotes and URL fragments", () => {
    const src = [
      "A=value # comment",
      'B="has # hash" # trailing',
      "C=https://x.dev/#frag",
      "D='  padded  '",
    ].join("\n");
    expect(formatDotenv(src)).toBe(
      ['A=value', 'B="has # hash"', "C=https://x.dev/#frag", "D='  padded  '", ""].join("\n")
    );
  });

  it("normalises CRLF line endings", () => {
    expect(formatDotenv("A=1\r\nB=2\r\n")).toBe("A=1\nB=2\n");
  });

  it("allows empty values", () => {
    expect(formatDotenv("EMPTY=\n")).toBe("EMPTY=\n");
  });

  it("throws a FormatError with the offending line number", () => {
    let err;
    try {
      formatDotenv("A=1\nnot an assignment\n");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(FormatError);
    expect(err.line).toBe(2);
    expect(err.message).toMatch(/Line 2/);
  });
});
