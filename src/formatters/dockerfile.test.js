import { describe, expect, it } from "vitest";
import { formatDockerfile } from "./dockerfile.js";
import { FormatError } from "./errors.js";

describe("formatDockerfile", () => {
  it("uppercases instructions and collapses whitespace", () => {
    const src = "from   node:22\nworkdir /app\n  copy  . .\n# build\nrun npm ci\n";
    expect(formatDockerfile(src)).toBe(
      "FROM node:22\nWORKDIR /app\nCOPY . .\n# build\nRUN npm ci\n"
    );
  });

  it("collapses runs of blank lines and ends with exactly one newline", () => {
    expect(formatDockerfile("FROM a\n\n\n\nRUN b\n\n\n")).toBe("FROM a\n\nRUN b\n");
  });

  it("splits long RUN && chains across continuation lines", () => {
    const src =
      "RUN apt-get update && apt-get install -y curl git build-essential && rm -rf /var/lib/apt/lists/*";
    expect(formatDockerfile(src)).toBe(
      [
        "RUN apt-get update \\",
        "    && apt-get install -y curl git build-essential \\",
        "    && rm -rf /var/lib/apt/lists/*",
        "",
      ].join("\n")
    );
  });

  it("expands long JSON-form CMD arrays", () => {
    const src =
      'CMD ["node", "--max-old-space-size=4096", "server.js", "--port", "8080", "--host", "0.0.0.0"]';
    expect(formatDockerfile(src)).toBe(
      [
        "CMD [",
        '    "node",',
        '    "--max-old-space-size=4096",',
        '    "server.js",',
        '    "--port",',
        '    "8080",',
        '    "--host",',
        '    "0.0.0.0"',
        "]",
        "",
      ].join("\n")
    );
  });

  it("keeps short JSON-form arrays on one line", () => {
    expect(formatDockerfile('cmd ["node", "a.js"]')).toBe('CMD ["node", "a.js"]\n');
  });

  it("indents continuation lines and never treats them as instructions", () => {
    const src = "run apt-get install -y \\\ncopy-tool \\\n      copy extra\n";
    expect(formatDockerfile(src)).toBe(
      "RUN apt-get install -y \\\n    copy-tool \\\n    copy extra\n"
    );
  });

  it("throws a FormatError for unknown instructions with position info", () => {
    let err;
    try {
      formatDockerfile("FROM node\n  BOGUS thing\n");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(FormatError);
    expect(err.line).toBe(2);
    expect(err.column).toBe(3);
  });
});
