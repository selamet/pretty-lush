import { describe, expect, it } from "vitest";
import { detectLangFromContent, detectLangFromFilename } from "./detect.js";

describe("detectLangFromFilename", () => {
  it.each([
    ["main.py", "python"],
    ["data.JSON", "json"],
    ["App.tsx", "tsx"],
    ["Dockerfile", "dockerfile"],
    ["api.dockerfile", "dockerfile"],
    [".env", "dotenv"],
    [".env.production", "dotenv"],
  ])("%s -> %s", (name, lang) => {
    expect(detectLangFromFilename(name)).toBe(lang);
  });

  it("returns null for missing, extensionless or unknown names", () => {
    expect(detectLangFromFilename("")).toBeNull();
    expect(detectLangFromFilename(null)).toBeNull();
    expect(detectLangFromFilename("Makefile")).toBeNull();
    expect(detectLangFromFilename("archive.xyz")).toBeNull();
  });
});

describe("detectLangFromContent", () => {
  it.each([
    ["shell", "#!/bin/bash\necho hello world from a script\n"],
    ["dockerfile", "FROM node:22-alpine\nWORKDIR /app\nRUN npm ci\n"],
    ["html", "<!doctype html>\n<html><body>hello</body></html>"],
    ["vue", "<template>\n  <div>{{ msg }}</div>\n</template>\n"],
    ["yaml", "name: pretty-lush\nversion: 1\nitems:\n  - a\n"],
    ["json", '{"name": "pretty-lush", "version": 1}'],
    ["sql", "SELECT id, name FROM users WHERE id = 1"],
    ["python", "def greet(name):\n    return f'hi {name}'\n"],
    ["dotenv", "API_URL=https://example.com\nDEBUG=true\n"],
    ["typescript", "interface User {\n  id: number;\n  name: string;\n}"],
    ["tsx", "type Props = { name: string };\nconst A = (p: Props) => <Card name={p.name} />;"],
    ["javascript", "const add = (a, b) => {\n  return a + b;\n};"],
    ["jsx", "export function App() {\n  return (<Button onClick={go}>Go</Button>);\n}"],
    ["markdown", "# Title\n\nSome paragraph with [a link](https://x.dev)."],
    ["css", ".card { padding: 12px; border: 1px solid red; }"],
  ])("detects %s", (lang, src) => {
    expect(detectLangFromContent(src)).toBe(lang);
  });

  it("returns null for short or unrecognisable input", () => {
    expect(detectLangFromContent("")).toBeNull();
    expect(detectLangFromContent("   short   ")).toBeNull();
    expect(detectLangFromContent("just some plain prose without any hints at all")).toBeNull();
  });

  it("does not treat invalid JSON-looking text as json", () => {
    expect(detectLangFromContent("{ this is: not, valid json at all }")).not.toBe("json");
  });
});
