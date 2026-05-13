// `mvdan/sh` shipped as a Go-WASM module via the `sh-syntax` npm package.
// We expose a single `print` function and lazily load both the JS shim and
// the .wasm blob on first use.
import { mapShError } from "./errors.js";

let _print = null;
let _initPromise = null;
async function loadPrint() {
  if (_print) return _print;
  if (!_initPromise) {
    _initPromise = (async () => {
      const mod = await import("sh-syntax");
      const wasmUrl = (await import("sh-syntax/main.wasm?url")).default;
      const processor = mod.getProcessor(() => fetch(wasmUrl));
      _print = (text, opts) => processor(text, { ...opts, print: true });
      return _print;
    })();
  }
  return _initPromise;
}

export async function formatShell(src, opts) {
  const print = await loadPrint();
  const useTabs = opts.indent === "tab";
  try {
    return await print(src, {
      tabWidth: useTabs ? 4 : Number(opts.indent) || 2,
      useTabs,
    });
  } catch (e) {
    throw mapShError(e);
  }
}
