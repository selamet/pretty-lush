// Ruff (black-compatible) compiled to WebAssembly. We initialise the WASM
// module once and reuse a `Workspace` instance across calls; the workspace
// itself is rebuilt whenever the user's indent / line-width / quote
// preferences change so Ruff sees them on the next format.
import { mapRuffError } from "./errors.js";

let _mod = null;
let _initPromise = null;
async function initRuff() {
  if (_mod) return _mod;
  if (!_initPromise) {
    _initPromise = (async () => {
      const mod = await import("@astral-sh/ruff-wasm-web");
      const wasmUrl = (
        await import("@astral-sh/ruff-wasm-web/ruff_wasm_bg.wasm?url")
      ).default;
      await mod.default(wasmUrl);
      _mod = mod;
      return mod;
    })();
  }
  return _initPromise;
}

// Ruff workspace settings for the user's settings. The python* overrides
// (from an imported ruff.toml / pyproject.toml) win over the shared
// indent / line width / quotes.
export function ruffSettings(opts) {
  const indent = opts.pythonIndent ?? opts.indent;
  const quotes = opts.pythonQuotes ?? opts.quotes;
  const useTabs = indent === "tab";
  return {
    "line-length": Number(opts.pythonLineWidth ?? opts.lineWidth) || 88,
    "indent-width": useTabs ? 4 : Number(indent) || 4,
    format: {
      "indent-style": useTabs ? "tab" : "space",
      "quote-style":
        quotes === "single" ? "single" : quotes === "double" ? "double" : "preserve",
    },
  };
}

let _ws = null;
let _wsKey = "";
async function getWorkspace(opts) {
  const mod = await initRuff();
  const settings = ruffSettings(opts);
  const key = JSON.stringify(settings);
  if (_ws && _wsKey === key) return _ws;
  _ws = new mod.Workspace(settings, mod.PositionEncoding.Utf16);
  _wsKey = key;
  return _ws;
}

export async function formatPython(src, opts) {
  const ws = await getWorkspace(opts);
  try {
    return ws.format(src);
  } catch (e) {
    throw mapRuffError(e);
  }
}

// Ruff linter on the same WASM module + Workspace used for formatting, so
// enabling lint costs no extra download. Returns Ruff's raw diagnostics;
// see src/lint/ruff-diagnostics.js for the CodeMirror mapping.
export async function lintPython(src, opts) {
  const ws = await getWorkspace(opts);
  return ws.check(src);
}
