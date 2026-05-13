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

let _ws = null;
let _wsKey = "";
async function getWorkspace(opts) {
  const mod = await initRuff();
  const useTabs = opts.indent === "tab";
  const indentWidth = useTabs ? 4 : Number(opts.indent) || 4;
  const key = `${opts.lineWidth}:${indentWidth}:${useTabs}:${opts.quotes}`;
  if (_ws && _wsKey === key) return _ws;
  const settings = {
    "line-length": Number(opts.lineWidth) || 88,
    "indent-width": indentWidth,
    format: {
      "indent-style": useTabs ? "tab" : "space",
      "quote-style":
        opts.quotes === "single"
          ? "single"
          : opts.quotes === "double"
            ? "double"
            : "preserve",
    },
  };
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
