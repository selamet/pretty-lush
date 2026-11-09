// TOML formatter. Browser-ready TOML formatters are either WASM blobs of
// tens of MB (@taplo/lib) or native/WASI bindings, so this is a small,
// careful tokenizer-based formatter instead. It never reorders anything —
// it only normalises whitespace:
//   - `key=value` → `key = value`, `a . b` → `a.b` (outside strings)
//   - `[ table ]` → `[table]`, `[[ array ]]` → `[[array]]`, with one blank
//     line before every table header (comments directly above stay attached)
//   - single-line arrays `[1,2]` → `[1, 2]`, inline tables `{a=1}` → `{ a = 1 }`
//   - multi-line arrays are re-indented by nesting depth
//   - string contents (incl. multi-line `"""` / `'''` strings) are untouched
//   - `value #comment` → `value #comment` with a single separating space
//   - blank-line runs collapse to one; output ends with a newline
// Structural problems (unterminated strings/brackets, lines that are not a
// key/value pair or table header) raise a FormatError with the line number.
import { FormatError } from "./errors.js";

function indentUnit(indent) {
  return indent === "tab" ? "\t" : " ".repeat(Number(indent) || 2);
}

const OPENERS = { "[": "]", "{": "}" };
const PUNCT = new Set(["[", "]", "{", "}", ",", "=", "."]);

// Separator emitted between the previously written token and the next one.
function separator(prev, tok, hadSpace) {
  if (prev === null) return "";
  if (tok === "," || tok === "." || prev === ".") return "";
  if (tok === "]") return "";
  if (tok === "}") return prev === "{" ? "" : " ";
  if (tok === "=" || prev === "=") return " ";
  if (prev === "[") return "";
  if (prev === "{" || prev === ",") return " ";
  // Two adjacent value tokens (e.g. the date and time of `1979-05-27 07:32:00`).
  return hadSpace ? " " : "";
}

// Scan one physical line, starting either at the beginning of a statement
// or in the middle of a multi-line array / string (state carries over).
// Returns the normalised text (without indentation) and whether a top-level
// `=` was seen.
function scanLine(text, state, lineNo) {
  let out = "";
  let i = 0;
  let prev = null;
  let hadSpace = false;
  let sawEquals = false;

  const fail = (msg) => {
    throw new FormatError(`Line ${lineNo}: ${msg}`, { line: lineNo });
  };

  const emit = (tok, kind) => {
    out += separator(prev, kind, hadSpace) + tok;
    prev = kind;
    hadSpace = false;
  };

  // Continue a multi-line string from a previous line verbatim.
  if (state.ml) {
    const end = findMultilineEnd(text, 0, state.ml);
    if (end < 0) return { text, raw: true, sawEquals };
    out = text.slice(0, end);
    i = end;
    state.ml = null;
    prev = "value";
  }

  while (i < text.length) {
    const c = text[i];

    if (c === " " || c === "\t") {
      hadSpace = true;
      i++;
      continue;
    }

    if (c === "#") {
      const comment = text.slice(i).trimEnd();
      out += (out ? " " : "") + comment;
      break;
    }

    if (text.startsWith('"""', i) || text.startsWith("'''", i)) {
      const delim = text.slice(i, i + 3);
      const end = findMultilineEnd(text, i + 3, delim);
      if (end < 0) {
        // Opens a multi-line string: keep the rest of this line verbatim.
        out += separator(prev, "value", hadSpace) + text.slice(i);
        state.ml = delim;
        return { text: out, raw: false, sawEquals };
      }
      emit(text.slice(i, end), "value");
      i = end;
      continue;
    }

    if (c === '"' || c === "'") {
      const end = findStringEnd(text, i);
      if (end < 0) fail("unterminated string");
      emit(text.slice(i, end), "value");
      i = end;
      continue;
    }

    if (PUNCT.has(c)) {
      if (c === "[" || c === "{") {
        state.stack.push(c);
      } else if (c === "]" || c === "}") {
        const open = state.stack.pop();
        if (!open || OPENERS[open] !== c) fail(`unexpected "${c}"`);
      } else if (c === "=" && state.stack.length === 0) {
        sawEquals = true;
      }
      emit(c, c);
      i++;
      continue;
    }

    // Bare word: key, number, boolean, date/time …
    let j = i;
    while (j < text.length && !/[\s#"'[\]{},=]/.test(text[j]) && text[j] !== ".") j++;
    // Floats and times contain dots; keep `1.5` / `07:32:00.999` together
    // when the dot is surrounded by digits.
    while (text[j] === "." && /\d/.test(text[j - 1] || "") && /\d/.test(text[j + 1] || "")) {
      j++;
      while (j < text.length && !/[\s#"'[\]{},=.]/.test(text[j])) j++;
    }
    emit(text.slice(i, j), "value");
    i = j;
  }

  return { text: out, raw: false, sawEquals };
}

// Index just past the closing quote of a single-line string, or -1.
function findStringEnd(text, start) {
  const q = text[start];
  for (let i = start + 1; i < text.length; i++) {
    if (q === '"' && text[i] === "\\") {
      i++;
      continue;
    }
    if (text[i] === q) return i + 1;
  }
  return -1;
}

// Index just past the closing delimiter of a multi-line string (TOML allows
// up to two extra quotes right before it), or -1.
function findMultilineEnd(text, from, delim) {
  for (let i = from; i < text.length; i++) {
    if (delim === '"""' && text[i] === "\\") {
      i++;
      continue;
    }
    if (text.startsWith(delim, i)) {
      let end = i + 3;
      while (end < text.length && end < i + 5 && text[end] === delim[0]) end++;
      return end;
    }
  }
  return -1;
}

const isComment = (line) => line.startsWith("#");

export function formatToml(src, opts = {}) {
  const unit = indentUnit(opts.indent ?? 2);
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const state = { stack: [], ml: null };
  const out = [];
  let mlStartLine = 0;
  let arrayStartLine = 0;

  for (let n = 0; n < lines.length; n++) {
    const lineNo = n + 1;
    const raw = lines[n];

    // Inside a multi-line string, lines are content: keep them byte-exact.
    if (state.ml) {
      const res = scanLine(raw, state, lineNo);
      if (res.raw) {
        out.push(raw);
        continue;
      }
      // Closing line: the string part is verbatim, the remainder normalised.
      out.push(res.text);
      if (state.ml) mlStartLine = lineNo;
      continue;
    }

    const line = raw.trim();
    const depth = state.stack.length;

    if (!line) {
      if (out.length > 0 && out[out.length - 1] !== "") out.push("");
      continue;
    }

    if (depth > 0) {
      // Inside a multi-line array: indent by nesting depth.
      const res = scanLine(line, state, lineNo);
      const closes = /^[\]}]/.test(line) ? 1 : 0;
      out.push(unit.repeat(Math.max(0, depth - closes)) + res.text);
      if (state.ml) mlStartLine = lineNo;
      continue;
    }

    if (isComment(line)) {
      out.push(line);
      continue;
    }

    const isHeader = line.startsWith("[");
    const res = scanLine(line, state, lineNo);

    if (isHeader) {
      if (state.stack.length > 0) {
        throw new FormatError(`Line ${lineNo}: unterminated table header`, { line: lineNo });
      }
      let at = out.length;
      while (at > 0 && out[at - 1] !== "" && isComment(out[at - 1])) at--;
      if (at > 0 && out[at - 1] !== "") out.splice(at, 0, "");
      out.push(res.text);
      continue;
    }

    if (!res.sawEquals) {
      throw new FormatError(`Line ${lineNo}: expected "key = value" or a [table] header`, {
        line: lineNo,
        hint: "every TOML line is a key/value pair, a [table] header or a # comment",
      });
    }
    if (state.stack.length > 0) arrayStartLine = lineNo;
    if (state.ml) mlStartLine = lineNo;
    out.push(res.text);
  }

  if (state.ml) {
    throw new FormatError(`Line ${mlStartLine}: unterminated multi-line string`, {
      line: mlStartLine,
    });
  }
  if (state.stack.length > 0) {
    throw new FormatError(`Line ${arrayStartLine}: unterminated array or inline table`, {
      line: arrayStartLine,
    });
  }

  while (out.length && out[out.length - 1] === "") out.pop();
  return out.length ? out.join("\n") + "\n" : "";
}
