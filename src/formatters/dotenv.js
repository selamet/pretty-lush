// Dotenv has no real grammar, just a convention. We normalise `KEY = value`
// spacing, collapse runs of blank lines, strip whitespace-prefixed inline
// `#` comments outside of quotes, and validate that every non-comment line
// is a `KEY=value` assignment.
import { FormatError } from "./errors.js";

function isQuoted(v) {
  return (
    (v.startsWith('"') && v.endsWith('"') && v.length >= 2) ||
    (v.startsWith("'") && v.endsWith("'") && v.length >= 2)
  );
}

function stripInlineComment(value) {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === "#" && !inSingle && !inDouble) {
      // Require whitespace before # so we don't eat URL fragments like https://x#frag.
      if (i === 0 || /\s/.test(value[i - 1])) {
        return value.slice(0, i).replace(/\s+$/, "");
      }
    }
  }
  return value;
}

export function formatDotenv(src) {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let prevBlank = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (!trimmed) {
      if (out.length > 0 && !prevBlank) out.push("");
      prevBlank = true;
      continue;
    }

    if (trimmed.startsWith("#")) {
      out.push(trimmed);
      prevBlank = false;
      continue;
    }

    const m = trimmed.match(
      /^(export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/
    );
    if (!m) {
      throw new FormatError(
        `Line ${i + 1} is not a KEY=value assignment`,
        { line: i + 1, hint: "dotenv lines must look like KEY=value or # comment" }
      );
    }

    const exportPrefix = m[1] ? "export " : "";
    const key = m[2];
    let value = m[3];

    value = stripInlineComment(value);
    if (!isQuoted(value)) value = value.trim();

    out.push(`${exportPrefix}${key}=${value}`);
    prevBlank = false;
  }

  while (out.length && out[out.length - 1] === "") out.pop();
  return out.join("\n") + "\n";
}
