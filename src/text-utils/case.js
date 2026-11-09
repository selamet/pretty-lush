export function toUpperCase(src) {
  return src.toUpperCase();
}

export function toLowerCase(src) {
  return src.toLowerCase();
}

export function toTitleCase(src) {
  return src.replace(
    /\b\w[\w']*/g,
    (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()
  );
}

// ── identifier-style case conversions ──────────────────────────────────
//
// All of them work line by line: each line is split into words and
// re-joined, keeping its leading indentation and trailing whitespace, so a
// list of names (or an indented block) converts in one go.

// Letters, combining marks and digits form words; anything else (space,
// `_`, `-`, `.`, `/`, punctuation) separates them.
const WORD_RE = /[\p{L}\p{M}\p{N}]+/gu;

/**
 * Splits text into words, also at camelCase / PascalCase boundaries:
 *
 *   "parseHTTPResponse" → ["parse", "HTTP", "Response"]
 *   "XMLHttpRequest"    → ["XML", "Http", "Request"]
 *   "version2Update"    → ["version2", "Update"]   (digits stay attached)
 *   "utf8 file-name"    → ["utf8", "file", "name"]
 *   "don't stop"        → ["dont", "stop"]         (apostrophes dropped)
 *
 * @param {string} text
 * @returns {string[]}
 */
export function splitWords(text) {
  const spaced = String(text)
    // Apostrophes inside words don't split them ("don't" → "dont").
    .replace(/([\p{L}\p{N}])['’](?=\p{L})/gu, "$1")
    // lower / digit → Upper: "fooBar", "base64Encode"
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, "$1 $2")
    // end of an acronym: "HTTPResponse" → "HTTP Response"
    .replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, "$1 $2");
  return spaced.match(WORD_RE) ?? [];
}

const lower = (w) => w.toLowerCase();
const upper = (w) => w.toUpperCase();
const capitalize = (w) => {
  const [first = "", ...rest] = w.toLowerCase();
  return first.toUpperCase() + rest.join("");
};

// Applies `convert(words) → string` to every line, keeping each line's
// leading and trailing whitespace; lines without words are left as is.
function mapLines(src, convert) {
  return src
    .split("\n")
    .map((line) => {
      const [, lead, body, trail] = line.match(/^(\s*)(.*?)(\s*)$/su);
      const words = splitWords(body);
      return words.length ? lead + convert(words, body) + trail : line;
    })
    .join("\n");
}

export function toCamelCase(src) {
  return mapLines(src, (w) => lower(w[0]) + w.slice(1).map(capitalize).join(""));
}

export function toPascalCase(src) {
  return mapLines(src, (w) => w.map(capitalize).join(""));
}

export function toSnakeCase(src) {
  return mapLines(src, (w) => w.map(lower).join("_"));
}

export function toScreamingSnakeCase(src) {
  return mapLines(src, (w) => w.map(upper).join("_"));
}

export function toKebabCase(src) {
  return mapLines(src, (w) => w.map(lower).join("-"));
}

export function toDotCase(src) {
  return mapLines(src, (w) => w.map(lower).join("."));
}

/**
 * Sentence case, per line. Identifier-like text — one token ("userId",
 * "HTTP_STATUS_CODE", "my-file.name") or space-separated words with no
 * punctuation ("fooBar baz_qux") — is split into words: "User id",
 * "Http status code", "Foo bar baz qux". Prose keeps its punctuation: it is
 * lowercased and the first letter of each sentence is capitalized —
 * "the QUICK fox. it ran" → "The quick fox. It ran".
 */
export function toSentenceCase(src) {
  return mapLines(src, (words, body) => {
    const identifier =
      /^[\p{L}\p{M}\p{N}_\s]+$/u.test(body) ||
      // one token like "my-file.name", but not a version / number ("2.0")
      (/^[\p{L}\p{M}\p{N}_\-./]+$/u.test(body) && !/\p{N}\.\p{N}/u.test(body));
    if (identifier) {
      return capitalizeFirstLetter(words.map(lower).join(" "));
    }
    return body
      .toLowerCase()
      .replace(/(^|[.!?]\s+)(\P{L}*)(\p{L})/gu, (_, pre, gap, ch) => pre + gap + ch.toUpperCase());
  });
}

function capitalizeFirstLetter(text) {
  return text.replace(/\p{L}/u, (ch) => ch.toUpperCase());
}
