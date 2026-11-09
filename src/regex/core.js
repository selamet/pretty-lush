// Pure core of the Regex tester: flag handling, `/pattern/flags` parsing,
// capture-group naming, the match model, replacement preview and the worker
// message protocol. No DOM, no CodeMirror — the worker (regex.worker.js) is a
// thin shell around `handleRegexMessage`, so everything here runs in Node
// tests exactly as it runs in the worker.

// Flags offered as toggles, in canonical (RegExp#flags) order.
export const REGEX_FLAGS = [
  { id: "d", label: "indices", title: "d — hasIndices: report capture group ranges" },
  { id: "g", label: "global", title: "g — global: find every match, not just the first" },
  { id: "i", label: "ignore case", title: "i — ignoreCase: case-insensitive matching" },
  { id: "m", label: "multiline", title: "m — multiline: ^ and $ match at line breaks" },
  { id: "s", label: "dotAll", title: "s — dotAll: . also matches line breaks" },
  { id: "u", label: "unicode", title: "u — unicode: code point matching, \\p{…} escapes" },
  { id: "v", label: "unicodeSets", title: "v — unicodeSets: u plus set operations in [ ]" },
  { id: "y", label: "sticky", title: "y — sticky: match only at lastIndex (consecutive matches)" },
];

const FLAG_ORDER = REGEX_FLAGS.map((f) => f.id).join("");

// Most matches collected (and highlighted) per run.
export const MAX_MATCHES = 10_000;
// Longest match / group value kept in the model; longer ones are cut and
// flagged, the full text is still in the editor.
export const MAX_VALUE_CHARS = 500;

// Sorts flags canonically and drops duplicates and unknown flags.
export function normalizeFlags(flags) {
  const set = new Set(String(flags ?? ""));
  return [...FLAG_ORDER].filter((f) => set.has(f)).join("");
}

// Turns flag `id` on or off. `u` and `v` are mutually exclusive, so turning
// one on turns the other off.
export function toggleFlag(flags, id) {
  const set = new Set(normalizeFlags(flags));
  if (set.has(id)) {
    set.delete(id);
  } else {
    set.add(id);
    if (id === "u") set.delete("v");
    if (id === "v") set.delete("u");
  }
  return normalizeFlags([...set].join(""));
}

/**
 * Parses a regex literal like `/a+b/gi` (as pasted from code). Returns
 * `{ pattern, flags }` or null when `text` is not a literal: it must start
 * with `/`, end with `/` + letters, and the letters must all be known flags
 * without repeats. Escaped slashes inside stay as written (`\/`).
 */
export function parseRegexLiteral(text) {
  const m = /^\s*\/([\s\S]+)\/([a-z]*)\s*$/.exec(String(text ?? ""));
  if (!m) return null;
  const [, pattern, flags] = m;
  if (new Set(flags).size !== flags.length) return null;
  if ([...flags].some((f) => !FLAG_ORDER.includes(f))) return null;
  return { pattern, flags: normalizeFlags(flags) };
}

// Compiles `pattern` with `flags`. Returns `{ regex }` or `{ error }` with
// the engine's message (e.g. "Invalid regular expression: /(/: Unterminated
// group"), never throws.
export function compileRegex(pattern, flags) {
  try {
    return { regex: new RegExp(pattern, flags) };
  } catch (e) {
    return { error: e?.message || String(e) };
  }
}

/**
 * Names of the capture groups of `pattern`, in group-number order:
 * `names[0]` is group 1's name, or null for an unnamed group. Scans the
 * source: escapes and character classes are skipped, `(?<name>` is a named
 * group, other `(?` forms (non-capturing, lookarounds, modifiers) are not
 * groups. `unicodeSets` enables nested classes (`v` flag).
 */
export function captureGroupNames(pattern, { unicodeSets = false } = {}) {
  const names = [];
  let classDepth = 0;
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "\\") {
      i++;
      continue;
    }
    if (classDepth > 0) {
      if (c === "]") classDepth--;
      else if (c === "[" && unicodeSets) classDepth++;
      continue;
    }
    if (c === "[") {
      classDepth = 1;
      continue;
    }
    if (c !== "(") continue;
    if (pattern[i + 1] !== "?") {
      names.push(null);
      continue;
    }
    if (pattern[i + 2] === "<" && pattern[i + 3] !== "=" && pattern[i + 3] !== "!") {
      const end = pattern.indexOf(">", i + 3);
      names.push(end === -1 ? null : pattern.slice(i + 3, end));
    }
  }
  return names;
}

function clip(value) {
  if (value.length <= MAX_VALUE_CHARS) return { value, clipped: false };
  return { value: value.slice(0, MAX_VALUE_CHARS), clipped: true };
}

/**
 * Builds the match model of `pattern`/`flags` over `text`. Without `g` only
 * the first match is reported (like `String#match`); with `y` matches must
 * be consecutive. Ranges are UTF-16 offsets (CodeMirror positions). Group
 * ranges are always collected (the regex is run with `d` internally) so
 * groups can be highlighted whatever the user's flags.
 *
 * @returns {{ status: "ok", matches: Array<{ index, start, end, value,
 *   clipped, groups: Array<{ n, name, start, end, value, clipped }> }>,
 *   truncated: boolean, groupNames: Array<string|null>, replaced: string|null }
 *   | { status: "error", error: string }}
 *   `start`/`end`/`value` of a group that did not participate are null.
 */
export function buildMatchModel({
  pattern,
  flags = "",
  text = "",
  replacement = null,
  maxMatches = MAX_MATCHES,
}) {
  const userFlags = normalizeFlags(flags);
  const compiled = compileRegex(pattern, userFlags);
  if (compiled.error) return { status: "error", error: compiled.error };
  const groupNames = captureGroupNames(pattern, { unicodeSets: userFlags.includes("v") });

  const global = userFlags.includes("g");
  const scan = new RegExp(pattern, normalizeFlags(userFlags + "dg"));
  const matches = [];
  let truncated = false;
  for (const m of text.matchAll(scan)) {
    if (matches.length >= maxMatches) {
      truncated = true;
      break;
    }
    // Sticky without global: String#match semantics only look at index 0.
    if (!global && userFlags.includes("y") && m.index !== 0) break;
    const groups = [];
    for (let n = 1; n < m.length; n++) {
      const range = m.indices[n];
      const raw = m[n];
      const { value, clipped } = raw === undefined ? { value: null, clipped: false } : clip(raw);
      groups.push({
        n,
        name: groupNames[n - 1] ?? null,
        start: range ? range[0] : null,
        end: range ? range[1] : null,
        value,
        clipped,
      });
    }
    const { value, clipped } = clip(m[0]);
    matches.push({
      index: matches.length,
      start: m.index,
      end: m.index + m[0].length,
      value,
      clipped,
      groups,
    });
    if (!global) break;
  }

  return {
    status: "ok",
    matches,
    truncated,
    groupNames,
    replaced: replacement == null ? null : replacePreview(compiled.regex, text, replacement),
  };
}

// `String#replace` with the user's regex, so `$1`, `$<name>`, `$&`, `` $` ``,
// `$'` and `$$` behave exactly as in JavaScript (first match only without g).
export function replacePreview(regex, text, replacement) {
  regex.lastIndex = 0;
  return text.replace(regex, replacement);
}

/**
 * Highlight ranges for the test editor: one per match (alternating
 * `variant` 0/1) and one per participating group (`variant` = group number
 * mod 4), clamped to `docLength`. Empty matches become zero-width `empty`
 * markers so they stay visible.
 */
export function highlightRanges(matches, docLength) {
  const out = [];
  for (const m of matches) {
    if (m.start > docLength) break;
    const end = Math.min(m.end, docLength);
    if (m.start === end) {
      out.push({ kind: "empty", from: m.start, to: m.start, variant: m.index % 2 });
      continue;
    }
    out.push({ kind: "match", from: m.start, to: end, variant: m.index % 2 });
    for (const g of m.groups) {
      if (g.start == null || g.start === g.end) continue;
      const gEnd = Math.min(g.end, docLength);
      if (g.start >= gEnd) continue;
      out.push({ kind: "group", from: g.start, to: gEnd, variant: (g.n - 1) % 4 });
    }
  }
  return out;
}

// Worker protocol. Request: { id, pattern, flags, text, replacement?,
// maxMatches? }. The worker first answers { id, type: "started" } (so the
// caller can start its timeout only once the run really began), then
// { id, type: "result", ...buildMatchModel(), elapsedMs }.
export function startedMessage(data) {
  return { id: data?.id ?? null, type: "started" };
}

export function handleRegexMessage(data, now = () => Date.now()) {
  const id = data?.id ?? null;
  if (typeof data?.pattern !== "string" || typeof data?.text !== "string") {
    return { id, type: "result", status: "error", error: "Malformed regex request" };
  }
  const t0 = now();
  let model;
  try {
    model = buildMatchModel(data);
  } catch (e) {
    model = { status: "error", error: e?.message || String(e) };
  }
  return { id, type: "result", ...model, elapsedMs: Math.max(0, now() - t0) };
}

// Strips the engine's "Invalid regular expression: /…/flags: " prefix so the
// inline error reads "Unterminated group" rather than repeating the pattern.
export function friendlyRegexError(message) {
  const text = String(message ?? "");
  const m = /^Invalid regular expression: \/[\s\S]*\/[a-z]*: ([\s\S]+)$/.exec(text);
  return m ? m[1] : text;
}
