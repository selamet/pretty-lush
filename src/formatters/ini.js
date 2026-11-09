// INI has no formal grammar, so this is a conservative heuristic formatter:
//   - `[ section ]` headers become `[section]`, with one blank line before
//     each section (comments directly above a header stay attached to it)
//   - `key=value` / `key : value` become `key = value` / `key: value`
//   - `;` and `#` comment lines are kept verbatim (trimmed)
//   - indented lines that follow a key and are not themselves assignments
//     are treated as multi-line value continuations and re-indented
//   - runs of blank lines collapse to one; output ends with a newline
// It never throws: unknown lines are kept as-is (trimmed).

const SECTION = /^\[\s*([^\]]*?)\s*\]\s*(.*)$/;
// Key: anything up to the first `=` or `:` that does not start with a
// comment / section character.
const ASSIGNMENT = /^([^=:;#[\s][^=:]*?)\s*([=:])\s*(.*)$/;

function indentUnit(indent) {
  return indent === "tab" ? "\t" : " ".repeat(Number(indent) || 2);
}

const isComment = (line) => line.startsWith(";") || line.startsWith("#");

export function formatIni(src, opts = {}) {
  const unit = indentUnit(opts.indent ?? 2);
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  // "key" while the previous meaningful line was a key or a continuation —
  // only then can an indented line be a continuation of its value.
  let prev = null;

  const pushBlank = () => {
    if (out.length > 0 && out[out.length - 1] !== "") out.push("");
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) {
      pushBlank();
      prev = null;
      continue;
    }

    if (isComment(line)) {
      out.push(line);
      prev = null;
      continue;
    }

    const section = line.match(SECTION);
    if (section) {
      // Keep comments that sit directly above the header attached to it by
      // inserting the separating blank line before them instead.
      let at = out.length;
      while (at > 0 && out[at - 1] !== "" && isComment(out[at - 1])) at--;
      if (at > 0 && out[at - 1] !== "") out.splice(at, 0, "");
      const trailing = section[2] ? ` ${section[2]}` : "";
      out.push(`[${section[1]}]${trailing}`);
      prev = "section";
      continue;
    }

    const assign = line.match(ASSIGNMENT);
    const indented = /^\s/.test(raw);
    if (indented && prev === "key" && !assign) {
      out.push(unit + line);
      continue;
    }

    if (assign) {
      const [, key, sep, value] = assign;
      if (sep === "=") out.push(value ? `${key} = ${value}` : `${key} =`);
      else out.push(value ? `${key}: ${value}` : `${key}:`);
      prev = "key";
      continue;
    }

    // Bare keys (e.g. `skip-networking` in my.cnf) and anything else.
    out.push(line);
    prev = "key";
  }

  while (out.length && out[out.length - 1] === "") out.pop();
  return out.length ? out.join("\n") + "\n" : "";
}
