// JSON minify / escape / unescape — quick transforms for JSON that is
// embedded in strings, logs, env vars and source code.

/** Error with an optional 1-based line / column (rendered by ErrorCard). */
export class JsonStringError extends Error {
  constructor(message, { line = null, column = null, hint = null } = {}) {
    super(message);
    this.name = "JsonStringError";
    this.line = line;
    this.column = column;
    this.hint = hint;
  }
}

// 0-based offset → 1-based { line, column }.
function lineColumnAt(text, offset) {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: offset - lineStart + 1 };
}

// JSON.parse that throws JsonStringError with line / column when the engine
// reports a position ("… at position N").
function parseStrict(text, what) {
  try {
    return JSON.parse(text);
  } catch (e) {
    const raw = String(e?.message || e).split("\n")[0];
    const m = /position\s+(\d+)/i.exec(raw);
    const loc = m ? lineColumnAt(text, Number(m[1])) : {};
    throw new JsonStringError(`${what} is not valid JSON: ${raw}`, {
      ...loc,
      hint: "Check for trailing commas, single quotes, or missing brackets",
    });
  }
}

function isWhitespace(code) {
  return code === 0x20 || code === 0x0a || code === 0x0d || code === 0x09;
}

/**
 * Removes all insignificant whitespace from JSON text. Works on the token
 * stream rather than re-serialising, so key order (including integer-like
 * keys), duplicate keys and number literals (`1.0`, `1e3`, big integers) are
 * kept exactly as written.
 * @throws {JsonStringError} with line / column when the input is not JSON.
 */
export function minifyJson(input) {
  const text = String(input ?? "");
  if (!text.trim()) throw new JsonStringError("Input is empty");
  parseStrict(text, "Input");
  let out = "";
  let segmentStart = 0;
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (inString) {
      if (c === 0x5c) i++; // backslash: skip the escaped char
      else if (c === 0x22) inString = false;
    } else if (c === 0x22) {
      inString = true;
    } else if (isWhitespace(c)) {
      out += text.slice(segmentStart, i);
      segmentStart = i + 1;
    }
  }
  return out + text.slice(segmentStart);
}

/**
 * Turns the whole input into one JSON string literal (quotes, backslashes and
 * control characters escaped; other Unicode, emoji included, kept as is), e.g.
 * for embedding a JSON document in code or an env var.
 */
export function escapeJsonString(input) {
  return JSON.stringify(String(input ?? ""));
}

// Escapes raw control characters (a pasted literal that spans lines) so the
// text can be read as the inside of a JSON string literal.
function escapeRawControls(s) {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u001f]/g, (ch) => JSON.stringify(ch).slice(1, -1));
}

// Reads one level of string-literal encoding, with or without the
// surrounding double quotes.
function readStringLiteral(text) {
  const quoted = text.length >= 2 && text.startsWith('"') && text.endsWith('"');
  const body = quoted ? text.slice(1, -1) : text;
  try {
    return JSON.parse(`"${escapeRawControls(body)}"`);
  } catch (e) {
    throw new JsonStringError(
      `Not a valid JSON string literal: ${String(e?.message || e).split("\n")[0]}`,
      { hint: 'Paste an escaped string, e.g. "{\\"id\\": 1}" (quotes optional)' }
    );
  }
}

// Value of `text` if it is a JSON document, otherwise undefined.
function tryParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Decodes a JSON string literal (surrounding quotes optional). Double /
 * triple encoded payloads are unwrapped until the value is no longer a
 * string. When the decoded text is a JSON object or array it is
 * pretty-printed and `lang` is "json"; otherwise the plain decoded text is
 * returned with `lang: null`.
 *
 * @param {string} input
 * @param {{ indent?: number|"tab" }} [opts]
 * @returns {{ text: string, lang: "json"|null, depth: number }}
 *   `depth` is how many string encodings were removed.
 * @throws {JsonStringError}
 */
export function unescapeJsonString(input, { indent = 2 } = {}) {
  const text = String(input ?? "").trim();
  if (!text) throw new JsonStringError("Input is empty");

  const direct = tryParse(text);
  if (direct !== undefined && typeof direct !== "string") {
    if (direct !== null && typeof direct === "object") {
      throw new JsonStringError("Input is already unescaped JSON", {
        hint: "Use Format to pretty-print it, or Escape to turn it into a string",
      });
    }
    // A bare number / boolean / null without quotes reads as its own text.
  }

  let value = typeof direct === "string" ? direct : readStringLiteral(text);
  let depth = 1;
  for (;;) {
    const next = tryParse(value.trim());
    if (typeof next === "string") {
      value = next;
      depth++;
      continue;
    }
    if (next !== null && typeof next === "object") {
      const space = indent === "tab" ? "\t" : Math.max(1, Number(indent) || 2);
      return { text: JSON.stringify(next, null, space) + "\n", lang: "json", depth };
    }
    return { text: value, lang: null, depth };
  }
}
