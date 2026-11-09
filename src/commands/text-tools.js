import {
  sortLines,
  dedupeLines,
  reverseLines,
  trimEachLine,
  collapseBlankLines,
  toUpperCase,
  toLowerCase,
  toTitleCase,
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
} from "../text-utils/index.js";

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
//               pane and `toast` is shown ("<toast> applied").
//   modal     — `decode(input)` result is shown in the tool modal registered
//               under that id in components/ToolModalHost.jsx;
//               `emptyMessage` is shown when the input is empty.
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
  { id: "util-upper", group: "Text", label: "UPPERCASE", keywords: "case", toast: "Uppercase", transform: toUpperCase },
  { id: "util-lower", group: "Text", label: "lowercase", keywords: "case", toast: "Lowercase", transform: toLowerCase },
  { id: "util-title", group: "Text", label: "Title Case", keywords: "case", toast: "Title case", transform: toTitleCase },
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
  // ── special ───────────────────────────────────────
  { id: "util-jwt", group: "Decode", label: "Decode JWT", keywords: "token jsonwebtoken", modal: "jwt", decode: decodeJwt, emptyMessage: "Paste a JWT first" },
  { id: "util-ts-iso", group: "Decode", label: "Unix timestamp → ISO date", keywords: "epoch time", toast: "Timestamp → ISO", transform: timestampToIso },
  { id: "util-iso-ts", group: "Decode", label: "ISO date → Unix timestamp", keywords: "epoch time", toast: "ISO → timestamp", transform: isoToTimestamp },
];
