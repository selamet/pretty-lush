// A heuristic Dockerfile formatter:
//   - validates instruction names (FROM, RUN, COPY, …)
//   - uppercases the instruction
//   - collapses runs of whitespace in the argument
//   - expands long `CMD` / `ENTRYPOINT` JSON arrays
//   - splits long `RUN … && … && …` chains across continuation lines
import { FormatError } from "./errors.js";
import { MAX_LINE, splitTopLevelCommas } from "./helpers.js";

const DOCKER_INSTRUCTIONS = new Set([
  "FROM",
  "RUN",
  "CMD",
  "LABEL",
  "MAINTAINER",
  "EXPOSE",
  "ENV",
  "ADD",
  "COPY",
  "ENTRYPOINT",
  "VOLUME",
  "USER",
  "WORKDIR",
  "ARG",
  "ONBUILD",
  "STOPSIGNAL",
  "HEALTHCHECK",
  "SHELL",
]);

export function formatDockerfile(src) {
  // First pass: validate every non-comment, non-continuation line.
  const rawLines = src.split("\n");
  let cont = false;
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trim = line.trim();
    if (cont) {
      cont = line.trimEnd().endsWith("\\");
      continue;
    }
    if (!trim || trim.startsWith("#")) continue;
    const m = trim.match(/^(\S+)/);
    if (m) {
      const inst = m[1].toUpperCase();
      if (!DOCKER_INSTRUCTIONS.has(inst)) {
        throw new FormatError(`Unknown instruction “${m[1]}”`, {
          line: i + 1,
          column: line.indexOf(m[1]) + 1,
          hint: "expected FROM, RUN, COPY, CMD, etc.",
        });
      }
    }
    cont = line.trimEnd().endsWith("\\");
  }

  const out = [];
  let inContinuation = false;
  for (const raw of src.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    // Lines continuing a previous `\`-terminated instruction are arguments,
    // not instructions: keep them verbatim apart from a uniform indent, so a
    // word like `copy` at their start is never uppercased.
    if (inContinuation) {
      inContinuation = line.endsWith("\\");
      out.push(line.trim() ? `    ${line.trim()}` : "");
      continue;
    }
    if (!line.trim()) { out.push(""); continue; }
    if (line.trim().startsWith("#")) { out.push(line.trim()); continue; }
    inContinuation = line.endsWith("\\");
    const m = line.match(/^\s*(\S+)\s+(.*)$/);
    if (!m) { out.push(line.trim()); continue; }
    const word = m[1].toUpperCase();
    const rest = m[2].replace(/\s+/g, " ").trim();

    if (!DOCKER_INSTRUCTIONS.has(word)) { out.push(line.trim()); continue; }

    // Already split across lines by the author: only normalise the head line.
    if (!inContinuation) {
      // JSON-form array (CMD, ENTRYPOINT): expand when the resulting line is too long.
      if (
        rest.startsWith("[") &&
        rest.endsWith("]") &&
        (`${word} ${rest}`.length > MAX_LINE)
      ) {
        const parts = splitTopLevelCommas(rest.slice(1, -1))
          .map((p) => p.trim())
          .filter(Boolean);
        out.push(`${word} [`);
        parts.forEach((p, i) =>
          out.push(`    ${p}${i < parts.length - 1 ? "," : ""}`)
        );
        out.push(`]`);
        continue;
      }

      // RUN ... && ... && ...: split the chain across continuation lines.
      if (word === "RUN" && rest.length > MAX_LINE && rest.includes("&&")) {
        const chunks = rest.split(/\s*&&\s*/).map((c) => c.trim()).filter(Boolean);
        out.push(`RUN ${chunks[0]} \\`);
        chunks.slice(1).forEach((c, i) => {
          const suffix = i === chunks.length - 2 ? "" : " \\";
          out.push(`    && ${c}${suffix}`);
        });
        continue;
      }
    }

    out.push(`${word} ${rest}`);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").replace(/\n+$/, "") + "\n";
}
