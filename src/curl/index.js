// "cURL → code": a pasted cURL command → fetch, axios or Python requests.
// Pure and dependency-free: ./tokenize.js splits shell words, ./parse.js
// builds a request model and one emitter per target prints it.
import { parseCurl } from "./parse.js";
import { emitFetch } from "./fetch.js";
import { emitAxios } from "./axios.js";
import { emitRequests } from "./requests.js";

export { parseCurl } from "./parse.js";
export { tokenizeShell } from "./tokenize.js";

// `lang` highlights the generated code, `filename` is what Download saves.
export const CURL_TARGETS = [
  { id: "fetch", label: "fetch", short: "fetch", lang: "javascript", filename: "request.js", emit: emitFetch },
  { id: "axios", label: "axios", short: "axios", lang: "javascript", filename: "request.js", emit: emitAxios },
  { id: "requests", label: "Python requests", short: "requests", lang: "python", filename: "request.py", emit: emitRequests },
];

export function getCurlTarget(id) {
  return CURL_TARGETS.find((t) => t.id === id) || CURL_TARGETS[0];
}

// True when the text is a cURL command (optionally behind a `$ ` prompt).
export function looksLikeCurl(text) {
  return /^\s*(\$\s+)?curl(\.exe)?\s+\S/.test(text || "");
}

/**
 * Converts a cURL command to code for `target`.
 * @returns {{ code: string, warnings: string[] }}
 * @throws FormatError when the text isn't a usable cURL command
 */
export function convertCurl(target, text) {
  const req = parseCurl(text);
  return { code: getCurlTarget(target).emit(req), warnings: req.warnings };
}
