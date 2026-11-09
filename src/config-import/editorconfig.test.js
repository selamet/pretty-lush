import { describe, it, expect } from "vitest";
import { mapEditorConfig, parseEditorConfig } from "./editorconfig.js";

const reasonOf = (r, option) => r.ignored.find((i) => i.option === option)?.reason;

describe("parseEditorConfig", () => {
  it("parses sections, lowercases keys/values and drops comments", () => {
    const parsed = parseEditorConfig(
      "root = true\n# comment\n; other\n[*]\nIndent_Style = Space ; inline\n\n[*.md]\ntrim_trailing_whitespace=false\n"
    );
    expect(parsed).toEqual([
      { section: null, props: [["root", "true"]] },
      { section: "*", props: [["indent_style", "space"]] },
      { section: "*.md", props: [["trim_trailing_whitespace", "false"]] },
    ]);
  });
});

describe("mapEditorConfig", () => {
  it("maps [*] indent, width, end of line and quotes", () => {
    const r = mapEditorConfig(
      "root = true\n[*]\nindent_style = space\nindent_size = 4\nmax_line_length = 100\nend_of_line = crlf\nquote_type = single\n"
    );
    expect(r.patch).toEqual({ indent: 4, lineWidth: 100, endOfLine: "crlf", quotes: "single" });
    expect(r.ignored).toEqual([]);
  });

  it("indent_style = tab wins over indent_size", () => {
    const r = mapEditorConfig("[*]\nindent_style = tab\nindent_size = 4\n");
    expect(r.patch).toEqual({ indent: "tab" });
    expect(reasonOf(r, "indent_size")).toMatch(/tabs/);
  });

  it("indent_size = tab means tabs; indent_size alone means spaces", () => {
    expect(mapEditorConfig("[*]\nindent_size = tab\n").patch).toEqual({ indent: "tab" });
    expect(mapEditorConfig("[*]\nindent_size = 2\n").patch).toEqual({ indent: 2 });
  });

  it("spaces without a size are reported", () => {
    const r = mapEditorConfig("[*]\nindent_style = space\n");
    expect(r.patch).toEqual({});
    expect(reasonOf(r, "indent_style")).toMatch(/indent_size/);
  });

  it("later [*] sections win", () => {
    const r = mapEditorConfig("[*]\nindent_size = 2\nmax_line_length = 80\n[*]\nindent_size = 4\n");
    expect(r.patch).toEqual({ indent: 4, lineWidth: 80 });
  });

  it("maps [*.py] to the Python overrides", () => {
    const r = mapEditorConfig("[*]\nindent_size = 2\n[*.py]\nindent_size = 4\nmax_line_length = 88\nquote_type = double\n");
    expect(r.patch).toEqual({ indent: 2, pythonIndent: 4, pythonLineWidth: 88, pythonQuotes: "double" });
    expect(r.applied.map((a) => a.option)).toContain("[*.py] indent_size");
  });

  it("reports other sections, unsupported, unknown and invalid properties", () => {
    const r = mapEditorConfig(
      "charset = utf-8\n[*]\ncharset = utf-8\nmax_line_length = off\nend_of_line = native\nfoo = bar\nindent_size = huge\n[*.{js,ts}]\nindent_size = 4\n"
    );
    expect(r.patch).toEqual({});
    expect(reasonOf(r, "charset")).toBeDefined();
    expect(reasonOf(r, "max_line_length")).toMatch(/off/);
    expect(reasonOf(r, "end_of_line")).toMatch(/invalid/);
    expect(reasonOf(r, "foo")).toBe("unknown option");
    expect(reasonOf(r, "indent_size")).toMatch(/invalid/);
    expect(reasonOf(r, "[*.{js,ts}]")).toMatch(/only \[\*\]/);
  });

  it("reports a file without [*]", () => {
    const r = mapEditorConfig("root = true\n[*.md]\nindent_size = 4\n");
    expect(r.patch).toEqual({});
    expect(reasonOf(r, "[*]")).toMatch(/no \[\*\] section/);
  });
});
