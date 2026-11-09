import {
  sortLines,
  dedupeLines,
  reverseLines,
  trimEachLine,
  collapseBlankLines,
  toUpperCase,
  toLowerCase,
  toTitleCase,
  toCamelCase,
  toPascalCase,
  toSnakeCase,
  toScreamingSnakeCase,
  toKebabCase,
  toDotCase,
  toSentenceCase,
  base64Encode,
  base64Decode,
  urlEncode,
  urlDecode,
  hexEncode,
  hexDecode,
  decodeJwt,
  timestampToIso,
  isoToTimestamp,
  pythonToJson,
  jsonToPython,
  minifyJson,
  escapeJsonString,
  unescapeJsonString,
} from "../text-utils/index.js";
import { pickCronExpression } from "../cron/index.js";

// Indent used by Python dict → JSON: never tabs, never zero.
export function jsonIndentFor(indent) {
  return Number(indent) === 0 || indent === "tab" ? 2 : Number(indent) || 2;
}

// Indent used by JSON → Python dict: tabs become 4 spaces.
export function pythonIndentFor(indent) {
  return indent === "tab" ? 4 : Number(indent) || 4;
}

// Declarative ⌘K tools that act on the current input. Each entry is one of:
//
//   transform — `(input, settings) => output`. The result replaces the output
//               pane and `toast` is shown ("<toast> applied"). It is a
//               one-shot output transform: auto-format only re-runs when the
//               input or settings change. A transform may instead return
//               `{ text, lang?, view? }`:
//                 lang — switch the editor to that language and make `text`
//                        its input too (previous input saved in Recent);
//                 view — force the JSON output view ("code"), e.g. so a
//                        minified result isn't hidden behind the tree view.
//               With `useSelection`, a non-empty selection in the input
//               editor is transformed in place instead (each selection
//               range separately, undoable with ⌘Z); `transform` must then
//               return a string.
//   modal     — `decode(input)` result is shown in the tool modal registered
//               under that id in components/ToolModalHost.jsx;
//               `emptyMessage` is shown when the input is empty. With
//               `useSelection`, a non-empty selection in the input editor is
//               used instead of the whole input; `decode(text, { source })`
//               gets source "selection" or "input", plus `selection`,
//               `cursorLine` (the input line under the cursor) and `input`.
//               With `allowEmpty`, the modal also opens on an empty input.
//
// Order here is the order in the palette.
export const TEXT_TOOLS = [
  // ── lines / case ──────────────────────────────────
  { id: "util-sort-asc", group: "Text", label: "Sort lines (A→Z)", keywords: "alphabetize", toast: "Sort A→Z", transform: (s) => sortLines(s, { reverse: false }) },
  { id: "util-sort-desc", group: "Text", label: "Sort lines (Z→A)", keywords: "alphabetize reverse", toast: "Sort Z→A", transform: (s) => sortLines(s, { reverse: true }) },
  { id: "util-dedupe", group: "Text", label: "Dedupe lines", keywords: "unique distinct", toast: "Dedupe", transform: dedupeLines },
  { id: "util-reverse", group: "Text", label: "Reverse line order", keywords: "flip", toast: "Reverse", transform: reverseLines },
  { id: "util-trim", group: "Text", label: "Trim trailing whitespace", keywords: "rtrim cleanup", toast: "Trim", transform: trimEachLine },
  { id: "util-collapse", group: "Text", label: "Collapse blank lines", keywords: "squeeze empty", toast: "Collapse blanks", transform: collapseBlankLines },
  // Case tools convert the selection in place when there is one.
  { id: "util-upper", group: "Text", label: "UPPERCASE", keywords: "case", toast: "Uppercase", useSelection: true, transform: toUpperCase },
  { id: "util-lower", group: "Text", label: "lowercase", keywords: "case", toast: "Lowercase", useSelection: true, transform: toLowerCase },
  { id: "util-title", group: "Text", label: "Title Case", keywords: "case", toast: "Title case", useSelection: true, transform: toTitleCase },
  { id: "util-sentence", group: "Text", label: "Sentence case", keywords: "case capitalize first letter", toast: "Sentence case", useSelection: true, transform: toSentenceCase },
  { id: "util-camel", group: "Text", label: "camelCase", keywords: "case identifier variable camel lower", toast: "camelCase", useSelection: true, transform: toCamelCase },
  { id: "util-pascal", group: "Text", label: "PascalCase", keywords: "case identifier class upper camel", toast: "PascalCase", useSelection: true, transform: toPascalCase },
  { id: "util-snake", group: "Text", label: "snake_case", keywords: "case identifier underscore python", toast: "snake_case", useSelection: true, transform: toSnakeCase },
  { id: "util-screaming-snake", group: "Text", label: "SCREAMING_SNAKE_CASE", keywords: "case identifier constant upper underscore env", toast: "SCREAMING_SNAKE_CASE", useSelection: true, transform: toScreamingSnakeCase },
  { id: "util-kebab", group: "Text", label: "kebab-case", keywords: "case identifier dash hyphen slug css", toast: "kebab-case", useSelection: true, transform: toKebabCase },
  { id: "util-dot", group: "Text", label: "dot.case", keywords: "case identifier dot period namespace", toast: "dot.case", useSelection: true, transform: toDotCase },
  // ── encoding ──────────────────────────────────────
  { id: "util-b64-enc", group: "Encode", label: "Base64 encode", keywords: "encode", toast: "Base64 encode", transform: base64Encode },
  { id: "util-b64-dec", group: "Encode", label: "Base64 decode", keywords: "decode", toast: "Base64 decode", transform: base64Decode },
  { id: "util-url-enc", group: "Encode", label: "URL encode (percent)", keywords: "uri escape", toast: "URL encode", transform: urlEncode },
  { id: "util-url-dec", group: "Encode", label: "URL decode (percent)", keywords: "uri unescape", toast: "URL decode", transform: urlDecode },
  { id: "util-hex-enc", group: "Encode", label: "String → hex", keywords: "encode", toast: "Hex encode", transform: hexEncode },
  { id: "util-hex-dec", group: "Encode", label: "Hex → string", keywords: "decode", toast: "Hex decode", transform: hexDecode },
  // ── conversion ────────────────────────────────────
  { id: "util-py-to-json", group: "Convert", label: "Python dict → JSON", keywords: "repr literal true false none", toast: "Python → JSON", transform: (s, settings) => pythonToJson(s, { indent: jsonIndentFor(settings.indent) }) },
  { id: "util-json-to-py", group: "Convert", label: "JSON → Python dict", keywords: "literal true false none", toast: "JSON → Python", transform: (s, settings) => jsonToPython(s, { indent: pythonIndentFor(settings.indent) }) },
  // ── JSON strings ──────────────────────────────────
  { id: "util-json-minify", group: "JSON", label: "Minify JSON", keywords: "compact compress one line whitespace", toast: "Minify", transform: (s) => ({ text: minifyJson(s), view: "code" }) },
  { id: "util-json-escape", group: "JSON", label: "Escape to JSON string", keywords: "stringify quote embed env literal", toast: "Escape", transform: escapeJsonString },
  { id: "util-json-unescape", group: "JSON", label: "Unescape JSON string", keywords: "unstringify parse double encoded literal unquote", toast: "Unescape", transform: (s, settings) => unescapeJsonString(s, { indent: settings.indent }) },
  // ── special ───────────────────────────────────────
  { id: "util-hash", group: "Hash", label: "Hash input…", keywords: "md5 sha sha1 sha256 sha384 sha512 digest checksum selection", modal: "hash", useSelection: true, decode: (text, { source }) => ({ text, source }), emptyMessage: "Input is empty" },
  { id: "util-jwt", group: "Decode", label: "Decode JWT", keywords: "token jsonwebtoken", modal: "jwt", decode: decodeJwt, emptyMessage: "Paste a JWT first" },
  { id: "util-cron", group: "Cron", label: "Explain cron expression", keywords: "crontab schedule next run times quartz job timer", modal: "cron", useSelection: true, allowEmpty: true, decode: (_text, ctx) => ({ expression: pickCronExpression(ctx) }) },
  { id: "util-ts-iso", group: "Decode", label: "Unix timestamp → ISO date", keywords: "epoch time", toast: "Timestamp → ISO", transform: timestampToIso },
  { id: "util-iso-ts", group: "Decode", label: "ISO date → Unix timestamp", keywords: "epoch time", toast: "ISO → timestamp", transform: isoToTimestamp },
];
