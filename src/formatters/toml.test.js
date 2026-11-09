import { describe, expect, it } from "vitest";
import { formatToml } from "./toml.js";
import { FormatError } from "./errors.js";

describe("formatToml", () => {
  it("normalises key/value spacing, dotted keys and table headers", () => {
    const src = 'title="demo"\n[ server . http ]\nport=8080\nsite . "google.com" = true\n';
    expect(formatToml(src)).toBe(
      'title = "demo"\n\n[server.http]\nport = 8080\nsite."google.com" = true\n'
    );
  });

  it("puts one blank line before every table and keeps comments above it", () => {
    const src = "a = 1\n# servers\n[[ servers ]]\nname = \"x\"\n\n\n\n[[servers]]\nname = \"y\"\n";
    expect(formatToml(src)).toBe(
      'a = 1\n\n# servers\n[[servers]]\nname = "x"\n\n[[servers]]\nname = "y"\n'
    );
  });

  it("spaces single-line arrays and inline tables", () => {
    expect(formatToml("ports=[ 8000,8001 ,8002 ]\npoint={x=1,y=2}\nempty = {}\nnone=[]\n")).toBe(
      "ports = [8000, 8001, 8002]\npoint = { x = 1, y = 2 }\nempty = {}\nnone = []\n"
    );
  });

  it("leaves string contents untouched", () => {
    const src = `a = "x=1, [y]  # not a comment"\nb='C:\\\\path  with  spaces'\n`;
    expect(formatToml(src)).toBe(
      `a = "x=1, [y]  # not a comment"\nb = 'C:\\\\path  with  spaces'\n`
    );
  });

  it("keeps numbers, floats and date-times intact", () => {
    const src = "pi=3.14159\nneg = -0.5\nodt=1979-05-27T07:32:00.999-07:00\nldt = 1979-05-27 07:32:00\nhex=0xDEAD_BEEF\n";
    expect(formatToml(src)).toBe(
      "pi = 3.14159\nneg = -0.5\nodt = 1979-05-27T07:32:00.999-07:00\nldt = 1979-05-27 07:32:00\nhex = 0xDEAD_BEEF\n"
    );
  });

  it("normalises inline comments to a single separating space", () => {
    expect(formatToml("a=1     # one\n[t]   # table\n")).toBe("a = 1 # one\n\n[t] # table\n");
  });

  it("re-indents multi-line arrays by depth", () => {
    const src = "deps = [\n\"a\",\n      \"b\",  # b\n[1,2],\n]\n";
    expect(formatToml(src, { indent: 4 })).toBe(
      'deps = [\n    "a",\n    "b", # b\n    [1, 2],\n]\n'
    );
    expect(formatToml("x = [\n1,\n]\n", { indent: "tab" })).toBe("x = [\n\t1,\n]\n");
  });

  it("keeps multi-line strings byte-exact", () => {
    const src = 'text="""\n  keep   this\n\n\n   = as is ]\n"""\nlit = \'\'\'\n raw  \'\'\'\nafter=1\n';
    expect(formatToml(src)).toBe(
      'text = """\n  keep   this\n\n\n   = as is ]\n"""\nlit = \'\'\'\n raw  \'\'\'\nafter = 1\n'
    );
  });

  it("collapses blank runs and is idempotent", () => {
    const src = "\n\n[a]\nx=1\n\n\n\ny=[1,\n2]\n\n";
    const once = formatToml(src);
    expect(once).toBe("[a]\nx = 1\n\ny = [1,\n  2]\n");
    expect(formatToml(once)).toBe(once);
  });

  it("returns an empty string for empty input", () => {
    expect(formatToml("\n\n")).toBe("");
  });

  it.each([
    ["not a pair\n", 1],
    ['a = 1\nb = "open\n', 2],
    ["a = [1,\n2\n", 1],
    ['a = """\nnever closed\n', 1],
    ["a = ]\n", 1],
  ])("rejects invalid input %j at line %i", (src, line) => {
    let err;
    try {
      formatToml(src);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(FormatError);
    expect(err.line).toBe(line);
  });
});
