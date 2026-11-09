import { describe, expect, it } from "vitest";
import { isCmdSyntax, tokenizeShell } from "./tokenize.js";

const words = (s) => tokenizeShell(s).words;

describe("tokenizeShell", () => {
  it("splits on whitespace", () => {
    expect(words("curl  -X\tPOST\nhttps://a.io")).toEqual(["curl", "-X", "POST", "https://a.io"]);
  });

  it("keeps single-quoted text literally", () => {
    expect(words(`curl -d '{"a": "b\\n"}'`)).toEqual(["curl", "-d", '{"a": "b\\n"}']);
  });

  it("handles double quotes and their escapes", () => {
    expect(words(`curl -d "{\\"a\\": \\"\\$HOME \\\\ \\x\\"}"`)).toEqual([
      "curl",
      "-d",
      '{"a": "$HOME \\ \\x"}',
    ]);
  });

  it("joins adjacent quoted and unquoted parts into one word", () => {
    expect(words(`curl -H 'X-A: '"b"c`)).toEqual(["curl", "-H", "X-A: bc"]);
  });

  it("keeps empty quoted words", () => {
    expect(words(`curl -d '' x`)).toEqual(["curl", "-d", "", "x"]);
  });

  it("decodes ANSI-C $'…' quoting", () => {
    expect(words(`curl --data-raw $'line1\\nline2\\t\\'q\\' \\x41\\u00e9\\101\\\\'`)).toEqual([
      "curl",
      "--data-raw",
      "line1\nline2\t'q' Aé" + "A\\",
    ]);
  });

  it("treats $\"…\" like double quotes", () => {
    expect(words(`curl $"a b"`)).toEqual(["curl", "a b"]);
  });

  it("removes backslash-newline continuations (LF and CRLF)", () => {
    expect(words("curl \\\n  -H 'a: 1' \\\r\n  https://a.io")).toEqual(["curl", "-H", "a: 1", "https://a.io"]);
  });

  it("handles backslash escapes outside quotes", () => {
    expect(words("curl a\\ b \\'c")).toEqual(["curl", "a b", "'c"]);
  });

  it("handles Windows cmd caret continuations and escapes", () => {
    const cmd = 'curl ^"https://a.io/?x=1^&y=2^" ^\r\n  -H ^"accept: */*^" ^\n  --data-raw ^"^{^\\^"a^\\^":1^}^"';
    expect(isCmdSyntax(cmd)).toBe(true);
    expect(words(cmd)).toEqual(["curl", "https://a.io/?x=1&y=2", "-H", "accept: */*", "--data-raw", '{"a":1}']);
  });

  it("leaves carets alone outside cmd syntax", () => {
    expect(isCmdSyntax("curl 'https://a.io/?q=^a'")).toBe(false);
    expect(words("curl 'https://a.io/?q=^a'")).toEqual(["curl", "https://a.io/?q=^a"]);
  });

  it("skips comments", () => {
    expect(words("# fetch users\ncurl https://a.io # trailing\n")).toEqual(["curl", "https://a.io"]);
    expect(words("curl a#b")).toEqual(["curl", "a#b"]);
  });

  it("stops at control operators", () => {
    expect(tokenizeShell("curl https://a.io | jq .")).toEqual({ words: ["curl", "https://a.io"], stoppedAt: "|" });
    expect(tokenizeShell("curl https://a.io && echo ok").stoppedAt).toBe("&&");
    expect(tokenizeShell("curl https://a.io > out.json").stoppedAt).toBe(">");
    expect(tokenizeShell("curl 'https://a.io/?a=1&b=2'").stoppedAt).toBe(null);
  });

  it("throws on unterminated quotes", () => {
    expect(() => tokenizeShell("curl 'abc")).toThrow(/Unterminated single quote/);
    expect(() => tokenizeShell('curl "abc')).toThrow(/Unterminated double quote/);
    expect(() => tokenizeShell("curl $'abc")).toThrow(/Unterminated \$'…' string/);
  });
});
