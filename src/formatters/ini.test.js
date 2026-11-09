import { describe, expect, it } from "vitest";
import { formatIni } from "./ini.js";

describe("formatIni", () => {
  it("normalises key/value spacing for '=' and ':' delimiters", () => {
    expect(formatIni("name=pretty lush\nport :8080\nempty=\n")).toBe(
      "name = pretty lush\nport: 8080\nempty =\n"
    );
  });

  it("trims section headers and separates sections with one blank line", () => {
    const src = "[ core ]\neditor=vim\n[user]\n\n\n\nname=Ada\n";
    expect(formatIni(src)).toBe("[core]\neditor = vim\n\n[user]\n\nname = Ada\n");
  });

  it("preserves ';' and '#' comments and keeps them attached to the next section", () => {
    const src = "; global\na=1\n; database settings\n# second line\n[db]\nhost = localhost ; inline\n";
    expect(formatIni(src)).toBe(
      "; global\na = 1\n\n; database settings\n# second line\n[db]\nhost = localhost ; inline\n"
    );
  });

  it("un-indents keys (e.g. .gitconfig) but re-indents value continuations", () => {
    const src = "[user]\n\tname = Ada\n\temail = ada@example.com\n[alias]\nlg = log\n        --graph\n        --oneline\n";
    expect(formatIni(src, { indent: 4 })).toBe(
      "[user]\nname = Ada\nemail = ada@example.com\n\n[alias]\nlg = log\n    --graph\n    --oneline\n"
    );
  });

  it("keeps bare keys and values containing delimiters", () => {
    const src = "[mysqld]\nskip-networking\nurl = https://x.dev/?a=1\n";
    expect(formatIni(src)).toBe("[mysqld]\nskip-networking\nurl = https://x.dev/?a=1\n");
  });

  it("normalises CRLF, trims leading/trailing blanks and is idempotent", () => {
    const once = formatIni("\r\n\r\n[a]\r\nx=1\r\n\r\n\r\n");
    expect(once).toBe("[a]\nx = 1\n");
    expect(formatIni(once)).toBe(once);
  });

  it("returns an empty string for blank input", () => {
    expect(formatIni("  \n\n")).toBe("");
  });
});
