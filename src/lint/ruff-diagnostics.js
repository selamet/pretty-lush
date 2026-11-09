// Pure mapping from Ruff's `Workspace.check()` output to CodeMirror lint
// diagnostics (@codemirror/lint `Diagnostic`), plus a few helpers for the
// problems list. No CodeMirror / WASM imports so it stays unit-testable.
//
// Ruff locations are 1-based `{ row, column }` pairs; with
// `PositionEncoding.Utf16` the column counts UTF-16 code units, which is
// exactly how JS strings (and CodeMirror offsets) index text.

// Ruff reports parse errors with this code (older builds used `null`).
const SYNTAX_CODES = new Set([null, undefined, "", "invalid-syntax"]);

export function isSyntaxCode(code) {
  return SYNTAX_CODES.has(code) || /^E9\d\d$/.test(code);
}

// Offsets where each line starts: starts[0] = 0, starts[n] = start of line n+1.
export function lineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) starts.push(i + 1);
  }
  return starts;
}

// Converts a 1-based Ruff location to a document offset, clamped into
// [0, text.length] and to the end of its line.
export function locationToOffset(starts, length, loc) {
  const row = Math.max(1, Math.floor(Number(loc?.row) || 1));
  const column = Math.max(1, Math.floor(Number(loc?.column) || 1));
  if (row > starts.length) return length;
  const lineStart = starts[row - 1];
  // Line end excludes the trailing "\n" (or is the end of the document).
  const lineEnd = row < starts.length ? starts[row] - 1 : length;
  return Math.min(lineStart + column - 1, Math.max(lineStart, lineEnd), length);
}

/**
 * @param {Array} raw   result of `Workspace.check(text)`
 * @param {string} text the exact text that was checked
 * @returns {Array<{from:number,to:number,severity:"error"|"warning",
 *   message:string,source:string,code:string,line:number,column:number,
 *   fixable:boolean}>} sorted by position
 */
export function mapRuffDiagnostics(raw, text) {
  if (!Array.isArray(raw) || typeof text !== "string") return [];
  const starts = lineStarts(text);
  const out = [];
  for (const d of raw) {
    if (!d || typeof d.message !== "string") continue;
    const syntax = isSyntaxCode(d.code);
    const code = SYNTAX_CODES.has(d.code) ? "syntax" : String(d.code);
    const from = locationToOffset(starts, text.length, d.start_location);
    const to = Math.max(
      from,
      locationToOffset(starts, text.length, d.end_location ?? d.start_location)
    );
    out.push({
      from,
      to,
      severity: syntax ? "error" : "warning",
      message: d.message,
      source: `Ruff ${code}`,
      code,
      line: Math.max(1, Number(d.start_location?.row) || 1),
      column: Math.max(1, Number(d.start_location?.column) || 1),
      fixable: !!d.fix,
    });
  }
  return out.sort((a, b) => a.from - b.from || a.to - b.to);
}

// Counts for the problems list badge.
export function countDiagnostics(list) {
  let errors = 0;
  let warnings = 0;
  for (const d of list || []) {
    if (d.severity === "error") errors++;
    else warnings++;
  }
  return { errors, warnings, total: errors + warnings };
}
