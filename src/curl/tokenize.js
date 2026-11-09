// Shell-words tokenizer for pasted cURL commands. Handles what "Copy as
// cURL" (Chrome, Firefox, Postman, docs) produces:
//   - single quotes, double quotes (with \" \\ \$ \` escapes) and
//     backslash escapes outside quotes;
//   - ANSI-C quoting: $'line\nbreak' (\n \t \xHH \uHHHH \0NNN …);
//   - backslash-newline continuations (bash) and caret continuations /
//     caret escapes (Windows cmd: `curl ^"https://x^" ^` + newline);
//   - `# comments` at the start of a word.
// Tokenizing stops at the first unquoted control operator (`|`, `;`, `&`,
// `>`, `<`) — everything after belongs to another command.
import { FormatError } from "../formatters/errors.js";

const ANSI_SIMPLE = {
  a: "\x07",
  b: "\b",
  e: "\x1b",
  E: "\x1b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
  v: "\v",
  "\\": "\\",
  "'": "'",
  '"': '"',
  "?": "?",
};

// True when the text uses Windows cmd caret syntax: a line ending with `^`
// or a `^"` escaped quote (Chrome's "Copy as cURL (cmd)").
export function isCmdSyntax(text) {
  return /\^\r?\n/.test(text) || /\^"/.test(text);
}

// cmd escapes: `^` + newline is a continuation, `^X` is a literal X.
function stripCarets(text) {
  return text.replace(/\^(\r?\n|[\s\S])/g, (_, ch) => (ch === "\n" || ch === "\r\n" ? "" : ch));
}

// Reads a $'…' body starting after the opening quote. Returns [value, end]
// where `end` is the index just past the closing quote.
function readAnsiC(src, start) {
  let out = "";
  let i = start;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "'") return [out, i + 1];
    if (ch !== "\\") {
      out += ch;
      i++;
      continue;
    }
    const next = src[i + 1];
    if (next === undefined) break;
    if (next in ANSI_SIMPLE) {
      out += ANSI_SIMPLE[next];
      i += 2;
      continue;
    }
    let m;
    if ((m = /^x([0-9a-fA-F]{1,2})/.exec(src.slice(i + 1)))) {
      out += String.fromCharCode(parseInt(m[1], 16));
      i += 1 + m[0].length;
    } else if ((m = /^u([0-9a-fA-F]{1,4})/.exec(src.slice(i + 1)))) {
      out += String.fromCodePoint(parseInt(m[1], 16));
      i += 1 + m[0].length;
    } else if ((m = /^U([0-9a-fA-F]{1,8})/.exec(src.slice(i + 1)))) {
      out += String.fromCodePoint(parseInt(m[1], 16));
      i += 1 + m[0].length;
    } else if ((m = /^[0-7]{1,3}/.exec(src.slice(i + 1)))) {
      out += String.fromCharCode(parseInt(m[0], 8));
      i += 1 + m[0].length;
    } else if (next === "c" && src[i + 2] !== undefined) {
      out += String.fromCharCode(src.charCodeAt(i + 2) & 0x1f);
      i += 3;
    } else {
      out += "\\" + next;
      i += 2;
    }
  }
  throw new FormatError("Unterminated $'…' string in the cURL command.", {
    hint: "Check that every quote is closed",
  });
}

const DOUBLE_QUOTE_ESCAPES = new Set(["$", "`", '"', "\\"]);
const OPERATORS = new Set(["|", ";", "&", ">", "<"]);

/**
 * Splits `text` into shell words.
 * @returns {{ words: string[], stoppedAt: string|null }} `stoppedAt` is the
 *   control operator that ended the command, if any.
 */
export function tokenizeShell(text) {
  const src = isCmdSyntax(text) ? stripCarets(text) : text;
  const words = [];
  let word = "";
  let inWord = false;
  let i = 0;

  const flush = () => {
    if (inWord) words.push(word);
    word = "";
    inWord = false;
  };

  while (i < src.length) {
    const ch = src[i];

    if (ch === "\\") {
      const next = src[i + 1];
      if (next === "\n") {
        i += 2;
        continue;
      }
      if (next === "\r" && src[i + 2] === "\n") {
        i += 3;
        continue;
      }
      if (next === undefined) {
        i++;
        continue;
      }
      word += next;
      inWord = true;
      i += 2;
      continue;
    }

    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      flush();
      i++;
      continue;
    }

    if (ch === "#" && !inWord) {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }

    if (OPERATORS.has(ch)) {
      flush();
      return { words, stoppedAt: ch === "&" && src[i + 1] === "&" ? "&&" : ch };
    }

    if (ch === "$" && src[i + 1] === "'") {
      const [value, end] = readAnsiC(src, i + 2);
      word += value;
      inWord = true;
      i = end;
      continue;
    }

    if (ch === "'") {
      const end = src.indexOf("'", i + 1);
      if (end < 0) {
        throw new FormatError("Unterminated single quote in the cURL command.", {
          hint: "Check that every quote is closed",
        });
      }
      word += src.slice(i + 1, end);
      inWord = true;
      i = end + 1;
      continue;
    }

    if (ch === '"' || (ch === "$" && src[i + 1] === '"')) {
      let j = ch === "$" ? i + 2 : i + 1;
      let closed = false;
      while (j < src.length) {
        const c = src[j];
        if (c === '"') {
          closed = true;
          j++;
          break;
        }
        if (c === "\\") {
          const next = src[j + 1];
          if (next === "\n") {
            j += 2;
            continue;
          }
          if (next !== undefined && DOUBLE_QUOTE_ESCAPES.has(next)) {
            word += next;
            j += 2;
            continue;
          }
        }
        word += c;
        j++;
      }
      if (!closed) {
        throw new FormatError("Unterminated double quote in the cURL command.", {
          hint: "Check that every quote is closed",
        });
      }
      inWord = true;
      i = j;
      continue;
    }

    word += ch;
    inWord = true;
    i++;
  }
  flush();
  return { words, stoppedAt: null };
}
