// Prettier standalone + plugin loaders. We lazy-load the core and every
// parser plugin on first use and cache by name so subsequent formats are
// instantaneous.
import { mapPrettierError } from "./errors.js";

let _core = null;
async function getCore() {
  if (_core) return _core;
  const mod = await import("prettier/standalone");
  _core = mod;
  return mod;
}

const _pluginCache = new Map();
async function loadPlugin(name, importer) {
  if (_pluginCache.has(name)) return _pluginCache.get(name);
  const mod = await importer();
  const plugin = mod.default || mod;
  _pluginCache.set(name, plugin);
  return plugin;
}

async function pluginsFor(parser) {
  switch (parser) {
    case "json":
    case "babel":
      return Promise.all([
        loadPlugin("babel", () => import("prettier/plugins/babel")),
        loadPlugin("estree", () => import("prettier/plugins/estree")),
      ]);
    case "yaml":
      return Promise.all([
        loadPlugin("yaml", () => import("prettier/plugins/yaml")),
      ]);
    case "markdown":
      return Promise.all([
        loadPlugin("markdown", () => import("prettier/plugins/markdown")),
      ]);
    case "css":
      return Promise.all([
        loadPlugin("postcss", () => import("prettier/plugins/postcss")),
      ]);
    case "html":
      return Promise.all([
        loadPlugin("html", () => import("prettier/plugins/html")),
      ]);
    case "typescript":
      return Promise.all([
        loadPlugin("typescript", () => import("prettier/plugins/typescript")),
        loadPlugin("estree", () => import("prettier/plugins/estree")),
      ]);
    // Vue SFC: html handles <template>, babel/ts handle <script>, postcss handles <style>.
    case "vue":
      return Promise.all([
        loadPlugin("html", () => import("prettier/plugins/html")),
        loadPlugin("babel", () => import("prettier/plugins/babel")),
        loadPlugin("typescript", () => import("prettier/plugins/typescript")),
        loadPlugin("postcss", () => import("prettier/plugins/postcss")),
        loadPlugin("estree", () => import("prettier/plugins/estree")),
      ]);
    default:
      return [];
  }
}

export async function formatWithPrettier(src, parser, opts) {
  const [core, plugins] = await Promise.all([getCore(), pluginsFor(parser)]);
  const useTabs = opts.indent === "tab";
  try {
    return await core.format(src, {
      parser,
      plugins,
      tabWidth: useTabs ? 4 : Number(opts.indent) || 2,
      useTabs,
      printWidth: Number(opts.lineWidth) || 80,
      singleQuote: opts.quotes === "single",
    });
  } catch (e) {
    throw mapPrettierError(e);
  }
}
