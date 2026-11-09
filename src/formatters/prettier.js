// Prettier standalone + plugin loaders. We lazy-load the core and every
// parser plugin on first use and cache by name so subsequent formats are
// instantaneous.
import { mapPrettierError } from "./errors.js";
import { SETTING_CHOICES } from "../state/settings.js";

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
    case "graphql":
      return Promise.all([
        loadPlugin("graphql", () => import("prettier/plugins/graphql")),
      ]);
    // XML / SVG: community plugin (@prettier/plugin-xml), pure JS.
    case "xml":
      return Promise.all([
        loadPlugin("xml", () => import("@prettier/plugin-xml")),
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

const choice = (key, value, fallback) =>
  SETTING_CHOICES[key].includes(value) ? value : fallback;

// Prettier options for the user's settings (without parser plugins). Missing
// or invalid values fall back to Prettier's defaults.
export function prettierOptions(parser, opts) {
  const useTabs = opts.indent === "tab";
  return {
    parser,
    tabWidth: useTabs ? 4 : Number(opts.indent) || 2,
    useTabs,
    printWidth: Number(opts.lineWidth) || 80,
    singleQuote: opts.quotes === "single",
    semi: opts.semi !== false,
    trailingComma: choice("trailingComma", opts.trailingComma, "all"),
    bracketSpacing: opts.bracketSpacing !== false,
    arrowParens: choice("arrowParens", opts.arrowParens, "always"),
    proseWrap: choice("proseWrap", opts.proseWrap, "preserve"),
    endOfLine: choice("endOfLine", opts.endOfLine, "lf"),
    // XML only: reflow freely so minified XML / SVG gets one element per
    // line (the plugin's "strict" default cannot add whitespace between
    // tags). Other parsers ignore this option.
    xmlWhitespaceSensitivity: "ignore",
  };
}

export async function formatWithPrettier(src, parser, opts) {
  const [core, plugins] = await Promise.all([getCore(), pluginsFor(parser)]);
  try {
    return await core.format(src, { ...prettierOptions(parser, opts), plugins });
  } catch (e) {
    throw mapPrettierError(e);
  }
}
