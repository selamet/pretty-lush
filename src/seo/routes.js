// Landing-page route table: one pre-rendered page per language plus a few
// tool pages. The single source of truth for
//   - the build-time page generator (src/seo/render.js via vite.config.js),
//   - sitemap.xml,
//   - the client, which preselects the language / view / tool from
//     `location.pathname` and keeps the URL in sync when the language changes.
// Pure data + helpers: no DOM, no Node APIs.
import { LANGUAGES } from "../languages/registry.js";

export const SITE_URL = "https://pretty-lush.selamet.dev";
export const SITE_NAME = "Pretty Lush";

export const HOME_ROUTE = {
  slug: "",
  kind: "home",
  path: "/",
  name: "Pretty Lush",
  title: "Pretty Lush — fast in-browser code formatter",
  description:
    "Format Python, JSON, YAML, SQL, Shell, Dockerfile, JSX/TSX, Vue and more in your browser. Powered by Prettier, Ruff and friends. Your code never leaves your device.",
  heading: "Pretty Lush — in-browser code formatter",
  intro:
    "Paste code, press Format, copy the result. Pretty Lush formats 20 languages with real formatters (Prettier, Ruff, sql-formatter, shfmt) compiled to JavaScript or WebAssembly, so everything runs locally in your browser tab.",
  faq: [],
};

// Shared answers, kept factual: formatting is local, formatters are cached.
const PRIVACY_QA = {
  q: "Is my code uploaded anywhere?",
  a: "No. Formatting runs entirely in your browser; the code you paste is not sent to a server. The only feature that talks to a backend is the optional encrypted share link, which encrypts the snippet in your browser first.",
};
const OFFLINE_QA = {
  q: "Does it work offline?",
  a: "Yes, once loaded. Pretty Lush is an installable PWA: the app shell is cached on the first visit and each formatter is cached the first time you use it.",
};

// Per-language copy. `name` is the short label used in titles; `engine`
// names the formatter actually used (see src/formatters/index.js).
const LANGUAGE_COPY = {
  python: {
    name: "Python",
    engine: "Ruff",
    title: "Python Formatter — Black-compatible, powered by Ruff",
    description:
      "Format Python code online with Ruff (Black-compatible style) compiled to WebAssembly. Optional Ruff lint diagnostics. Runs in your browser, no upload.",
    intro:
      "Paste Python and get Black-compatible formatting from Ruff's formatter, running as WebAssembly in your browser. Turn on Lint to see Ruff diagnostics inline, and convert a Python dict literal to JSON from the command palette.",
    faq: [
      { q: "Is the output the same as Black?", a: "Ruff's formatter is designed as a drop-in replacement for Black, so output matches Black for the vast majority of code." },
    ],
  },
  json: {
    name: "JSON",
    engine: "a strict JSON parser",
    title: "JSON Formatter & Validator — tree, table and JSONPath",
    description:
      "Format, validate and minify JSON online. Explore it as a searchable tree or table, filter with JSONPath, convert to YAML/TOML/CSV. Runs in your browser.",
    intro:
      "Paste JSON to pretty-print it with your indent of choice, or minify it to one line. Parse errors point at the exact line and column. Browse the result as a collapsible, searchable tree or a table, filter it with JSONPath, and convert it to YAML, TOML or CSV.",
    faq: [
      { q: "Can I filter large JSON documents?", a: "Yes. Type a JSONPath expression such as $.items[*].id and the output shows only the matched values; the tree view is virtualized for documents with thousands of nodes." },
    ],
  },
  yaml: {
    name: "YAML",
    engine: "Prettier",
    title: "YAML Formatter — format and convert YAML online",
    description:
      "Format YAML online with Prettier: consistent indentation and spacing, comments kept. Convert YAML to JSON or TOML. Runs in your browser, no upload.",
    intro:
      "Paste a YAML file (Kubernetes manifests, CI configs, docker-compose files) and Prettier normalizes indentation and spacing while keeping your comments. Use Convert to turn it into JSON or TOML.",
    faq: [
      { q: "Are YAML comments preserved?", a: "Yes. Prettier keeps comments when formatting YAML. Converting to another format drops them, since JSON has no comments." },
    ],
  },
  shell: {
    name: "Shell",
    engine: "mvdan/sh (shfmt) compiled to WebAssembly",
    title: "Shell Script Formatter — shfmt for Bash in the browser",
    description:
      "Format Bash and POSIX shell scripts online with mvdan/sh, the engine behind shfmt, compiled to WebAssembly. Runs in your browser, nothing uploaded.",
    intro:
      "Paste a Bash or POSIX shell script and it is parsed and re-printed by mvdan/sh, the library behind shfmt, running as WebAssembly. Syntax errors are reported with a line number.",
    faq: [
      { q: "Can it convert a cURL command to code?", a: "Yes. Paste a command that starts with curl and Pretty Lush offers to convert it to fetch, axios or Python requests." },
    ],
  },
  dockerfile: {
    name: "Dockerfile",
    engine: "a built-in Dockerfile formatter",
    title: "Dockerfile Formatter — tidy instructions and RUN chains",
    description:
      "Format Dockerfiles online: uppercase instructions, long RUN … && … chains split onto lines, long CMD/ENTRYPOINT arrays expanded. Runs in your browser.",
    intro:
      "Paste a Dockerfile to uppercase instructions, split long RUN … && … chains one command per line and expand long CMD / ENTRYPOINT JSON arrays. It is a lightweight heuristic formatter, so it never changes what your commands do.",
    faq: [],
  },
  javascript: {
    name: "JavaScript",
    engine: "Prettier",
    title: "JavaScript Formatter & Beautifier — Prettier online",
    description:
      "Beautify JavaScript online with Prettier. Choose indent, line width and quote style. Runs entirely in your browser, your code is never uploaded.",
    intro:
      "Paste JavaScript and Prettier reprints it with consistent spacing, line breaks and quotes. Indent (2, 4 or tabs), line width and quote style are configurable.",
    faq: [],
  },
  typescript: {
    name: "TypeScript",
    engine: "Prettier",
    title: "TypeScript Formatter — Prettier for TS online",
    description:
      "Format TypeScript online with Prettier's TypeScript parser: types, generics, decorators and all. Configurable indent and width. Runs in your browser.",
    intro:
      "Paste TypeScript and Prettier formats it with its TypeScript parser, so type annotations, generics and interfaces are laid out the same way your editor would.",
    faq: [],
  },
  jsx: {
    name: "JSX",
    engine: "Prettier",
    title: "JSX Formatter — format React components online",
    description:
      "Format React JSX online with Prettier: props wrapped, children indented, consistent quotes. Runs in your browser, no account and no upload.",
    intro:
      "Paste a React component written in JSX and Prettier wraps long prop lists, indents children and normalizes quotes, the same way it does in your editor.",
    faq: [],
  },
  tsx: {
    name: "TSX",
    engine: "Prettier",
    title: "TSX Formatter — format React + TypeScript online",
    description:
      "Format TSX (React components in TypeScript) online with Prettier's TypeScript parser. Configurable indent and line width. Runs in your browser.",
    intro:
      "Paste a React component written in TypeScript (TSX) and Prettier formats both the JSX markup and the type annotations.",
    faq: [],
  },
  vue: {
    name: "Vue",
    engine: "Prettier",
    title: "Vue SFC Formatter — template, script and style",
    description:
      "Format Vue single-file components online with Prettier: <template>, <script> and <style> blocks each formatted with their own parser. Runs in your browser.",
    intro:
      "Paste a .vue single-file component and Prettier formats each block with its native parser: HTML for the template, Babel or TypeScript for the script and PostCSS for the styles.",
    faq: [],
  },
  html: {
    name: "HTML",
    engine: "Prettier",
    title: "HTML Formatter & Beautifier — Prettier online",
    description:
      "Beautify HTML online with Prettier: nested tags indented, long attributes wrapped, inline scripts and styles formatted. Runs in your browser.",
    intro:
      "Paste HTML and Prettier indents nested elements, wraps long attribute lists and formats embedded <script> and <style> blocks.",
    faq: [],
  },
  css: {
    name: "CSS",
    engine: "Prettier",
    title: "CSS Formatter & Beautifier — Prettier online",
    description:
      "Beautify CSS online with Prettier: one declaration per line, consistent spacing and quotes. Configurable indent. Runs in your browser, nothing uploaded.",
    intro:
      "Paste CSS (minified or messy) and Prettier puts one declaration per line, normalizes spacing around selectors and values, and keeps your comments.",
    faq: [],
  },
  markdown: {
    name: "Markdown",
    engine: "Prettier",
    title: "Markdown Formatter — tidy lists, tables and headings",
    description:
      "Format Markdown online with Prettier: consistent list markers, aligned tables, normalized headings and code fences. Runs in your browser.",
    intro:
      "Paste Markdown and Prettier normalizes list markers and emphasis, aligns tables and cleans up spacing around headings and code fences.",
    faq: [],
  },
  dotenv: {
    name: "Dotenv",
    engine: "a built-in .env formatter",
    title: "Dotenv Formatter — clean up .env files",
    description:
      "Format .env files online: normalized KEY=value spacing, quoted values and inline comments preserved. Runs locally in your browser, secrets never leave it.",
    intro:
      "Paste a .env file to normalize KEY = value spacing. Quoted values and inline # comments outside quotes are kept as they are. Since everything runs locally, your secrets never leave the browser.",
    faq: [],
  },
  sql: {
    name: "SQL",
    engine: "sql-formatter",
    title: "SQL Formatter — beautify SQL queries online",
    description:
      "Beautify SQL queries online with sql-formatter: uppercase keywords, one clause per line, readable joins and subqueries. Runs in your browser.",
    intro:
      "Paste a SQL query and sql-formatter puts each clause on its own line, uppercases keywords and indents joins and subqueries, with your indent of choice.",
    faq: [],
  },
  xml: {
    name: "XML",
    engine: "Prettier with @prettier/plugin-xml",
    title: "XML & SVG Formatter — pretty-print XML online",
    description:
      "Pretty-print XML and SVG online with Prettier's XML plugin: minified XML expanded one element per line with consistent indentation. Runs in your browser.",
    intro:
      "Paste XML or SVG and Prettier's XML plugin expands it one element per line with consistent indentation, which makes minified files readable again.",
    faq: [],
  },
  graphql: {
    name: "GraphQL",
    engine: "Prettier",
    title: "GraphQL Formatter — format queries and schemas",
    description:
      "Format GraphQL queries, mutations and schema definitions online with Prettier. Configurable indent and line width. Runs in your browser.",
    intro:
      "Paste a GraphQL query, mutation, fragment or schema (SDL) and Prettier formats selections, arguments and type definitions consistently.",
    faq: [],
  },
  toml: {
    name: "TOML",
    engine: "a built-in TOML formatter",
    title: "TOML Formatter — tidy pyproject.toml and Cargo.toml",
    description:
      "Format TOML online: key = value and [table] spacing, arrays and inline tables re-indented, comments kept. Convert TOML to JSON or YAML. Runs in your browser.",
    intro:
      "Paste TOML (pyproject.toml, Cargo.toml, config files) to normalize key = value and [table] spacing and re-indent multi-line arrays. Strings and comments are left untouched, and unterminated strings or brackets are reported with a line number.",
    faq: [],
  },
  ini: {
    name: "INI",
    engine: "a built-in INI formatter",
    title: "INI Formatter — clean up INI and .cfg files",
    description:
      "Format INI and .cfg files online: normalized key = value spacing and [section] headers, comments preserved, sections separated. Runs in your browser.",
    intro:
      "Paste an INI or .cfg file to normalize key = value (and key: value) spacing and [section] headers. Sections are separated by one blank line and ; / # comments are preserved.",
    faq: [],
  },
  csv: {
    name: "CSV",
    engine: "a built-in RFC 4180 CSV parser",
    title: "CSV Formatter & CSV to JSON Converter",
    description:
      "Normalize CSV online with an RFC 4180 parser (quotes only where needed, LF line endings) and convert CSV to JSON, YAML or TOML. Runs in your browser.",
    intro:
      "Paste CSV to normalize quoting and line endings without changing any cell. Malformed rows are reported with a line number, and Convert turns the table into JSON (numbers and booleans inferred conservatively).",
    faq: [],
  },
};

function languageRoute(lang) {
  const copy = LANGUAGE_COPY[lang.id];
  if (!copy) throw new Error(`Missing landing copy for language "${lang.id}"`);
  const slug = `${lang.id}-formatter`;
  return {
    slug,
    kind: "language",
    path: `/${slug}`,
    lang: lang.id,
    name: `${copy.name} Formatter`,
    title: `${copy.title} | ${SITE_NAME}`,
    description: copy.description,
    heading: `${copy.name} Formatter`,
    intro: copy.intro,
    faq: [
      {
        q: `How do I format ${copy.name} online?`,
        a: `Paste your ${copy.name} into the input pane and press Format (⌘/Ctrl + Enter). Pretty Lush formats it with ${copy.engine} in your browser and shows the result side by side, ready to copy, download or share.`,
      },
      ...copy.faq,
      PRIVACY_QA,
    ],
  };
}

// Tool pages. `tool` tells the client what to open (see applyLandingRoute
// in App.jsx); `lang` is preselected before that.
const TOOL_ROUTES = [
  {
    slug: "json-to-typescript",
    lang: "json",
    tool: "typegen-typescript",
    name: "JSON to TypeScript",
    title: "JSON to TypeScript — generate interfaces, Zod and Pydantic",
    description:
      "Convert JSON to TypeScript types online. Also generates Zod schemas and Pydantic v2 models, with merged optional fields across array items. Runs in your browser.",
    heading: "JSON to TypeScript",
    intro:
      "Paste a JSON sample and get TypeScript types inferred from it, updated live as you edit. Switch the target to Zod or Pydantic v2, pick a root type name and copy or download the generated code.",
    faq: [
      { q: "How are optional fields detected?", a: "Objects inside arrays are merged: a key missing from some items becomes optional, and a key seen with different value types gets a union type." },
    ],
  },
  {
    slug: "json-schema-validator",
    lang: "json",
    tool: "schema",
    name: "JSON Schema Validator",
    title: "JSON Schema Validator — validate JSON with Ajv online",
    description:
      "Validate JSON against a JSON Schema online with Ajv and ajv-formats. Errors link to the exact line. Generate a schema from sample JSON. Runs in your browser.",
    heading: "JSON Schema Validator",
    intro:
      "Paste JSON on the left and a JSON Schema in the schema editor below it. The input is validated as you type with Ajv and ajv-formats, and each error points at the offending line. No schema yet? Generate one from your JSON.",
    faq: [
      { q: "Which JSON Schema drafts are supported?", a: "Draft-07 and 2020-12, picked from the schema's $schema keyword (2020-12 when it is missing). Generated schemas use 2020-12." },
    ],
  },
  {
    slug: "jwt-decoder",
    tool: "jwt",
    name: "JWT Decoder",
    title: "JWT Decoder — decode JSON Web Tokens locally",
    description:
      "Decode JWT header and payload in your browser and see issued-at and expiry times with an expired badge. The token never leaves your device.",
    heading: "JWT Decoder",
    intro:
      "Paste a JSON Web Token into the input and run Decode JWT from the command palette (⌘K). You get the decoded header and payload, the signature, the issued-at and expiry times and an expired badge. The signature is not verified; decoding happens locally.",
    faq: [
      { q: "Does the decoder verify the signature?", a: "No. It decodes the header and payload only, which is enough to inspect claims and expiry. Verifying a signature needs the secret or public key." },
    ],
  },
  {
    slug: "regex-tester",
    tool: "regex",
    name: "Regex Tester",
    title: "Regex Tester — test JavaScript regular expressions live",
    description:
      "Test JavaScript regular expressions online with live match highlighting, capture groups, all flags (d g i m s u v y), a replace preview and a cheat sheet.",
    heading: "Regex Tester",
    intro:
      "Type a /pattern/flags and test text to see every match highlighted with its capture groups, plus a live Replace preview. Matching runs in a Web Worker with a timeout, so a catastrophic pattern can't freeze the page.",
    faq: [
      { q: "Which regex flavor is used?", a: "Your browser's JavaScript (ECMAScript) regular expression engine, including the d, s, u, v and y flags." },
    ],
  },
  {
    slug: "curl-converter",
    lang: "shell",
    tool: "curl",
    // Seeded into the Shell input when it is empty or still the sample.
    sample: `curl -X POST https://api.example.com/v1/items \\\n  -H 'Content-Type: application/json' \\\n  -H 'Authorization: Bearer <token>' \\\n  -d '{"name":"ada","role":"engineer"}'`,
    name: "cURL Converter",
    title: "cURL to fetch, axios & Python requests converter",
    description:
      "Convert cURL commands to JavaScript fetch, axios or Python requests code online. Headers, data, auth and form fields supported. Runs in your browser.",
    heading: "cURL Converter",
    intro:
      "Paste a cURL command (for example from your browser's \"Copy as cURL\") and get equivalent code for fetch, axios or Python requests, updated as you edit. Flags that have no equivalent are listed as warnings instead of being silently dropped.",
    faq: [],
  },
  {
    slug: "cron-explainer",
    tool: "cron",
    name: "Cron Explainer",
    title: "Cron Expression Explainer — plain English + next runs",
    description:
      "Explain cron expressions in plain English and see the next 5 run times in local time or UTC. 5- and 6-field cron, ranges, steps, names and @daily macros.",
    heading: "Cron Expression Explainer",
    intro:
      "Type a cron expression such as 0 9 * * 1-5 to read it in plain English (\"At 09:00 on Monday through Friday\") and see its next five runs in local time or UTC, with a per-field breakdown and presets.",
    faq: [
      { q: "Are Quartz expressions supported?", a: "6-field expressions with seconds and ? are supported. Quartz-only L, W and # are reported as not supported rather than guessed." },
    ],
  },
].map((r) => ({
  ...r,
  kind: "tool",
  path: `/${r.slug}`,
  lang: r.lang ?? null,
  title: `${r.title} | ${SITE_NAME}`,
  faq: [...r.faq, PRIVACY_QA],
}));

export const LANGUAGE_ROUTES = LANGUAGES.map(languageRoute);
export { TOOL_ROUTES };

// Every landing page (home excluded), in sitemap / link-list order.
export const ROUTES = [...LANGUAGE_ROUTES, ...TOOL_ROUTES];

// The "Popular tools" list rendered in the app and on every static page.
export const POPULAR_SLUGS = [
  "json-formatter",
  "python-formatter",
  "yaml-formatter",
  "sql-formatter",
  "javascript-formatter",
  "typescript-formatter",
  "html-formatter",
  "xml-formatter",
  "json-to-typescript",
  "json-schema-validator",
  "jwt-decoder",
  "regex-tester",
  "curl-converter",
  "cron-explainer",
];

export function getRouteBySlug(slug) {
  return ROUTES.find((r) => r.slug === slug) ?? null;
}

export const POPULAR_ROUTES = POPULAR_SLUGS.map(getRouteBySlug);

// Landing route for a pathname (`/json-formatter`, `/json-formatter/`,
// `/json-formatter/index.html`), or null for `/` and unknown paths.
export function routeForPath(pathname) {
  if (typeof pathname !== "string") return null;
  const slug = pathname
    .replace(/\/index\.html$/, "")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
  if (!slug) return null;
  return getRouteBySlug(slug);
}

// Path to show for a language: its landing page, or `/` without one.
export function pathForLang(lang) {
  return LANGUAGE_ROUTES.find((r) => r.lang === lang)?.path ?? "/";
}

export function titleForLang(lang) {
  return LANGUAGE_ROUTES.find((r) => r.lang === lang)?.title ?? HOME_ROUTE.title;
}

export function canonicalUrl(route) {
  return `${SITE_URL}${route.path === "/" ? "/" : route.path}`;
}

// True when the URL carries a share link (`#s=` / `#p=`), which always wins
// over the landing route's preselection.
export function hasShareHash(hash) {
  return typeof hash === "string" && /^#[sp]=/.test(hash);
}
