// A single typed error class used by every formatter — gives the UI a
// stable surface to render (message, optional line/column, optional hint).

export class FormatError extends Error {
  constructor(message, { line = null, column = null, hint = null } = {}) {
    super(message);
    this.name = "FormatError";
    this.line = line;
    this.column = column;
    this.hint = hint;
  }
}

// Prettier raises rich error objects with a `loc.start`. Strip the noisy
// source-frame ASCII and keep just the message + position.
export function mapPrettierError(e) {
  const loc = e?.loc?.start;
  const msg = (e?.message || String(e))
    .replace(/^\s*>?\s*\d+\s*\|.*$/gm, "")
    .replace(/^\s*\|\s*\^+\s*$/gm, "")
    .replace(/\n{2,}/g, "\n")
    .replace(/\s*\(\d+:\d+\)\s*$/m, "")
    .trim();
  return new FormatError(msg, {
    line: loc?.line ?? null,
    column: loc?.column ?? null,
  });
}

// Ruff: "Failed to format: <msg> at <line>:<col>"
export function mapRuffError(e) {
  const raw = e?.message || String(e);
  const locMatch = raw.match(/(\d+):(\d+)/);
  const msg = raw
    .replace(/^Failed to format:\s*/i, "")
    .replace(/\s*at\s*\d+:\d+\s*$/i, "")
    .trim();
  return new FormatError(msg || "Could not parse Python source", {
    line: locMatch ? parseInt(locMatch[1], 10) : null,
    column: locMatch ? parseInt(locMatch[2], 10) : null,
  });
}

// sh-syntax: "<file>:<line>:<col>: <msg>"
export function mapShError(e) {
  const raw = e?.message || String(e);
  const m = raw.match(/:(\d+):(\d+):\s*(.+)$/);
  if (m) {
    return new FormatError(m[3].trim(), {
      line: parseInt(m[1], 10),
      column: parseInt(m[2], 10),
    });
  }
  return new FormatError(raw.trim());
}
