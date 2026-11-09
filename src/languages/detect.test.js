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
    ["feed.xml", "xml"],
    ["icon.SVG", "xml"],
    ["schema.graphql", "graphql"],
    ["query.gql", "graphql"],
    ["Cargo.toml", "toml"],
    ["php.ini", "ini"],
    ["setup.cfg", "ini"],
    [".editorconfig", "ini"],
    [".gitconfig", "ini"],
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
    ["xml", '<?xml version="1.0" encoding="UTF-8"?>\n<note><to>Ada</to></note>'],
    ["xml", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0"/></svg>'],
    ["graphql", "query GetUser($id: ID!) {\n  user(id: $id) { id name }\n}"],
    ["toml", '[package]\nname = "pretty-lush"\nversion = "0.1.0"\n'],
  ])("detects %s", (lang, src) => {
    expect(detectLangFromContent(src)).toBe(lang);
  });

  describe("XML", () => {
    it.each([
      ["DOCTYPE", '<!DOCTYPE note SYSTEM "note.dtd">\n<note><to>Ada</to></note>'],
      ["namespaced root", '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body/></soap:Envelope>'],
    ])("detects %s", (_, src) => {
      expect(detectLangFromContent(src)).toBe("xml");
    });

    it("keeps HTML documents as html", () => {
      expect(detectLangFromContent("<!DOCTYPE html>\n<html><body>hello</body></html>")).toBe("html");
      expect(detectLangFromContent('<html lang="en"><body>hello world</body></html>')).toBe("html");
    });
  });

  describe("GraphQL", () => {
    it.each([
      ["mutation", "mutation AddPost($title: String!) {\n  addPost(title: $title) { id }\n}"],
      ["fragment", "fragment UserFields on User {\n  id\n  name\n}"],
      ["anonymous subscription", "subscription {\n  postAdded { id title }\n}"],
      ["SDL with non-null fields", "type User {\n  id: ID!\n  name: String\n}"],
      ["SDL with implements", "type Post implements Node {\n  id: ID\n}"],
      ["SDL input", "input NewUser {\n  name: String\n  email: String\n}"],
      ["SDL union", "union SearchResult = User | Post\n"],
    ])("detects %s", (_, src) => {
      expect(detectLangFromContent(src)).toBe("graphql");
    });

    it("does not mistake TypeScript interfaces / types for SDL", () => {
      expect(detectLangFromContent("interface User {\n  id: string;\n  name?: string;\n}")).toBe("typescript");
      expect(detectLangFromContent("type Id = string | number;\nconst a: Id = 1;")).toBe("typescript");
    });
  });

  describe("TOML vs INI vs dotenv", () => {
    it.each([
      ["array tables", '[[bin]]\nname = "lush"\npath = "src/main.rs"\n'],
      ["typed values without headers", 'title = "demo"\nport = 8080\nenabled = true\n'],
      ["dotted tables and dates", '[server.http]\nstarted = 1979-05-27T07:32:00Z\nratio = 0.5\n'],
      ["multi-line arrays", 'deps = [\n  "a",\n  "b",\n]\nname = "x"\n'],
      ["inline tables", '[dependencies]\nserde = { version = "1.0", features = ["derive"] }\n'],
    ])("detects TOML: %s", (_, src) => {
      expect(detectLangFromContent(src)).toBe("toml");
    });

    it.each([
      ["bare values", "[server]\nhost = localhost\nport = 8080\n"],
      ["colon delimiter", "[database]\nuser: admin\npassword: secret\n"],
      ["semicolon comments", "; global settings\ntimeout = 30\nretries = 3\n"],
      ["gitconfig", "[user]\n\tname = Ada Lovelace\n\temail = ada@example.com\n"],
    ])("detects INI: %s", (_, src) => {
      expect(detectLangFromContent(src)).toBe("ini");
    });

    it("keeps upper-case KEY=value files as dotenv", () => {
      expect(detectLangFromContent('API_URL="https://example.com"\nDEBUG=true\n')).toBe("dotenv");
      expect(detectLangFromContent("NODE_ENV=production\nPORT=3000\n")).toBe("dotenv");
    });
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
