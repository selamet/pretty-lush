import { describe, expect, it } from "vitest";
import { formatCode } from "./index.js";
import { SAMPLES } from "../languages/registry.js";
import { detectLangFromContent } from "../languages/detect.js";

describe("formatCode — XML / GraphQL / TOML / INI", () => {
  it("formats the XML / SVG sample one element per line", async () => {
    const out = await formatCode("xml", SAMPLES.xml);
    expect(out).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8" ?>',
        "<svg",
        '  xmlns="http://www.w3.org/2000/svg"',
        '  width="24"',
        '  height="24"',
        '  viewBox="0 0 24 24"',
        ">",
        '  <g fill="none" stroke="currentColor">',
        '    <circle cx="12" cy="12" r="10" />',
        '    <path d="M8 12l3 3 5-6" />',
        "  </g>",
        "</svg>",
        "",
      ].join("\n")
    );
  });

  it("formats the GraphQL sample", async () => {
    const out = await formatCode("graphql", SAMPLES.graphql, { indent: 2 });
    expect(out.startsWith("query GetUser($id: ID!) {\n  user(id: $id) {\n    id\n    name\n")).toBe(true);
  });

  it("formats the TOML and INI samples", async () => {
    expect(await formatCode("toml", SAMPLES.toml)).toBe(
      [
        "[package]",
        'name = "pretty-lush"',
        'version = "0.1.0"',
        'keywords = ["formatter", "wasm"]',
        "",
        "[dependencies]",
        'serde = { version = "1.0", features = ["derive"] }',
        "",
        "[[bin]]",
        'name = "lush"',
        "",
      ].join("\n")
    );
    expect(await formatCode("ini", SAMPLES.ini)).toBe(
      [
        "; pretty-lush sample config",
        "[server]",
        "host = localhost",
        "port = 8080",
        "",
        "[database]",
        "user = admin",
        "path = /var/lib/db",
        "",
      ].join("\n")
    );
  });

  it("raises a FormatError for invalid XML", async () => {
    await expect(formatCode("xml", "<a><b></a>")).rejects.toMatchObject({ name: "FormatError" });
  });

  it.each(["xml", "graphql", "toml", "ini"])("auto-detects the %s sample", (lang) => {
    expect(detectLangFromContent(SAMPLES[lang])).toBe(lang);
  });
});
