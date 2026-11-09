# pretty-lush

A fast, private code formatter that runs **entirely in your browser**. Paste code, hit Format, copy the result. No uploads, no accounts, no telemetry.

Live: **<https://pretty-lush.selamet.dev>**

Powered by real formatters compiled to WebAssembly or pure JavaScript:

- **Prettier** — JSON · YAML · Markdown · CSS · HTML · JavaScript · TypeScript · JSX · TSX · Vue SFC · GraphQL
- **@prettier/plugin-xml** — XML / SVG
- **Ruff** — Python (black-compatible)
- **sh-syntax** — Shell / Bash
- **sql-formatter** — SQL (Postgres / MySQL / SQLite / BigQuery / …)
- Built-in formatters — TOML, INI, CSV, Dockerfile, Dotenv
- **yaml** · **smol-toml** — data converters (JSON ↔ YAML ↔ TOML ↔ CSV)

---

## Highlights

**Formatter**

- 20 languages out of the box: Python · JSON · YAML · TOML · CSV · XML / SVG · Shell · Dockerfile · JavaScript · TypeScript · JSX · TSX · Vue SFC · HTML · CSS · Markdown · GraphQL · SQL · INI · Dotenv
- Auto-detect language from pasted content or dropped files
- Drag-and-drop a file to load it (extension picks the language)
- Side-by-side editor with syntax highlighting (CodeMirror 6)
- **Tabs / snippets** — keep up to 20 snippets open in a tab strip above the editor. Each tab has its own language, input, output, JSONPath filter, Code / Tree / Table view and Types / cURL mode; settings, profiles, Compare and Regex stay global. "+" or `Alt+T` opens a tab, double-click or `F2` renames it (default names follow the language: "JSON", "JSON 2"…), drag or `Alt+Shift+←/→` (`⌘⌥←/→` on macOS, with the tab focused) reorders, right-click for Rename / Duplicate / Move / Close / Close other tabs. Closing a tab with content shows an **Undo** toast (or `Alt+Shift+T` / ⌘K → "Reopen closed tab"); closing the last tab leaves a fresh empty one. Tabs and the active tab survive reloads (your pre-tabs workspace becomes the first tab), share links open in a new tab, and the URL follows the active tab's language. ⌘K: "New tab", "Close tab", "Reopen closed tab", "Rename tab", "Go to tab: …"
- Inline diff view between input and output
- Configurable indent (2 / 4 / tab), line width, quote style; the settings popover adds Prettier's semicolons, trailing commas, bracket spacing, arrow parens, prose wrap and line endings
- **Import your repo's config** — "Import config…" in the settings popover (or ⌘K → "Import formatter config…") takes a pasted, picked or dropped `.prettierrc` (JSON / YAML / TOML), `package.json` (`"prettier"` key), `.editorconfig` (`[*]`, plus `[*.py]` for Python) or `ruff.toml` / `pyproject.toml` (`[tool.ruff]` line-length, indent-width, `[format]` quote-style / indent-style). A review step lists every applied option and every ignored one with the reason (unknown, unsupported, invalid value, lint rules, overrides…) before you apply. Ruff options become Python-only overrides, so they don't change Prettier output
- **Settings profiles** — save the current formatter options as a named profile, then switch, rename or delete from the settings popover or ⌘K ("Switch profile: …", "Save settings as profile…"). Your existing settings become the "Default" profile; the active profile follows your edits, shows on the toolbar's settings button, and persists across reloads
- Auto-format on type (debounced) and Format-on-paste options
- Local format history (last 20, click to restore)
- **Python lint (Ruff)** — optional "Lint" toggle (or ⌘K → "Turn on Python lint") shows Ruff diagnostics as inline markers plus a collapsible problems list (code, message, line:col; click to jump). Reuses the already-loaded Ruff WASM, no extra download; the setting persists

**JSON power tools**

- **JSONPath filter** — type an expression (`$.items[*].id`, `$..name`) in the JSON pane and the formatted output is the matched values
- **Tree view** — collapsible tree of the formatted JSON with a search box (keys and values, case-insensitive) that highlights matches, expands their parents and steps through them with Enter / Shift+Enter (or ⌘K → "Search JSON tree"). Every node has **Copy path** (valid JSONPath: `$.a.b[0]`, `$['weird key']` for keys that aren't identifiers), **Copy value** and **Filter by this path**, which sets the JSONPath filter and applies it — on hover, via the ⋮ button on touch, right-click or Shift+F10. Paths of a filtered output point back into the original input. Arrow keys navigate, expand and collapse; rows are virtualized so 5k+ node documents stay responsive
- **Table view** — when output is an array of objects, toggle between Code and a sticky-header table; **CSV** downloads the table as `table.csv`
- **Minify** — the toolbar button next to Format (or ⌘K → "Minify JSON") puts the JSON on one line, keeping key order and number literals exactly as written; it's a one-shot output transform, so Format-as-you-type won't re-indent it until you edit the input
- **Escape / Unescape** — ⌘K → "Escape to JSON string" turns the whole input into one JSON string literal (for code or env vars); "Unescape JSON string" decodes a literal (quotes optional), unwraps double / triple-encoded JSON from logs, and when the result is JSON pretty-prints it and switches to JSON (previous input saved in Recent)

**JSON Schema validation**

- **Schema** toggle in the JSON input pane (or ⌘K → "Validate JSON against a schema") opens a schema editor under the input; the input is validated as you type (debounced) with Ajv + ajv-formats, loaded on first use
- draft-07 and 2020-12, picked from `$schema` (2020-12 when absent); every error is listed with its JSON pointer, message and keyword — click one to jump to the offending value — and shown as inline markers in the input. Valid documents show a "Valid against schema" state; invalid schema JSON or an invalid schema gets its own error
- **Generate** (or ⌘K → "Generate JSON Schema from JSON") infers a 2020-12 schema from the current JSON with the same merge rules as Generate types; the schema persists across reloads
- Works alongside Types / Tree / Table in the output pane; it hides while the input isn't JSON (e.g. after Convert → YAML) and comes back when you return to JSON

**Data converters**

- **JSON ↔ YAML ↔ TOML ↔ CSV** — the **Convert** menu in the output pane (or ⌘K → "Convert JSON → YAML", …) converts the current input and switches the editor to the target language; the previous input is saved in Recent so you can go back with one click
- CSV follows RFC 4180 (quoted commas, quotes and newlines); the header is the union of all object keys, nested values are written as JSON. CSV → JSON infers numbers, booleans and JSON objects/arrays conservatively (`007` stays a string)
- Clear errors for data a target can't hold — e.g. CSV from a non-array, TOML from a top-level array or with `null` values

**Generate types from JSON**

- **TypeScript · Zod · Pydantic v2** — the **Types** button in the JSON output pane (or ⌘K → "Generate Zod schema from JSON", …) shows code generated from the JSON input, with a TS / Zod / Pydantic switcher and a root type name; copy, download (`types.ts` / `schema.ts` / `models.py`) and image export work on it, and ⌘⏎ or × goes back to the formatted output
- Shapes are merged across array elements: keys missing in some elements become optional, `null` makes a field nullable, mixed primitives become unions, ints vs floats are told apart (`int` / `float`, `z.number().int()`), ISO date-time strings become `datetime` in Pydantic
- Nested objects become named types (`addresses: [...]` → `Address`), identical shapes share one type, name collisions are numbered; non-identifier keys are quoted (TS / Zod) or get `Field(alias=…)` (Pydantic)

**cURL → code**

- Paste a cURL command (Chrome / Firefox "Copy as cURL", bash or Windows cmd, Postman snippets) and a banner offers to convert it; the **Code** button in the output pane (or ⌘K → "Convert cURL to fetch / axios / Python requests") shows the code live, with a fetch / axios / requests switcher; copy, download (`request.js` / `request.py`) and image export work on it
- Shell words are parsed like a shell: single / double quotes, `$'…'` ANSI-C strings, `\` and `^` line continuations
- Supports `-X`, URL / `--url`, `-H`, `-d` / `--data-raw` / `--data-binary` / `--data-urlencode` (joined with `&`, implicit POST, form content type), `--json`, `-F` (multipart, `@file` parts), `-u`, `-b`, `-A`, `-e`, `-G`, `-I`, `-k`, `-m`, `-L`, `--compressed`; JSON bodies are pretty-printed (`JSON.stringify({…})`, axios `data`, requests `json=`), `-u` becomes basic auth / `auth=`, `-k` becomes `verify=False` / an https agent; options that can't be expressed are listed in a small notice

**Compare mode**

- A standalone two-snippet diff (A vs B) with its own pair of editors, live diff below, Swap and Clear actions
- Both bodies persist across reloads

**Regex tester**

- **Regex** view (next to Format / Diff / Compare, or ⌘K → "Regex tester"): a `/pattern/flags` field with toggles for `d g i m s u v y`, a test-text editor seeded from the current input (**Use input** re-seeds it), a list of matches and a live **Replace** preview
- Matches are highlighted in alternating colors and capture groups are underlined in per-group colors; the list shows each match's index, range and value plus its numbered / named groups (group ranges with `d`) — click a match to select it in the text
- Replacement supports `$1`, `$<name>`, `$&`, `` $` ``, `$'` and `$$` (JavaScript `String#replace` semantics, first match only without `g`); copy the result with one click
- Pasting a literal like `/\d+/gi` into the pattern field fills in the flags; invalid patterns show the engine's error inline under the field
- Matching runs in a Web Worker with a 500 ms limit: a catastrophic pattern (e.g. `(a+)+$`) is stopped, the worker is replaced and "Pattern took too long (possible catastrophic backtracking)" is shown — the page never freezes. Results are capped at 10,000 matches
- **Cheat sheet** popover with a quick reference of the syntax; click an entry to insert it. Pattern, flags and replacement persist across reloads

**Text utilities (⌘K palette)**

- Lines: Sort A→Z / Z→A, Dedupe, Reverse, Trim trailing whitespace, Collapse blank lines
- Case: UPPERCASE · lowercase · Title Case · Sentence case · camelCase · PascalCase · snake_case · SCREAMING_SNAKE_CASE · kebab-case · dot.case — each line is converted on its own (indentation kept); with a selection in the input editor, only the selection is converted, in place (⌘Z undoes it). Words are split at spaces, `_ - . /` and camel / Pascal boundaries, with acronyms and digits handled (`parseHTTPResponse` → `parse_http_response`, `XMLHttpRequest` → `xml-http-request`, `version2Update` → `version2_update`, `utf8` stays one word) and Unicode letters supported
- Encoding: Base64 / URL percent / Hex — encode & decode in both directions
- **JWT decoder** with a small modal showing header, payload, signature, issued/expires meta and an `expired` badge
- Unix timestamp ↔ ISO date
- **Hash** — ⌘K → "Hash input…" shows MD5, SHA-1, SHA-256, SHA-384 and SHA-512 of the input (or just the selection) at once, over UTF-8 bytes, with a Hex / Base64 switch and a copy button per row. SHA via Web Crypto, MD5 in pure JS; MD5 / SHA-1 are marked insecure (checksums only)
- **UUID / ULID** — ⌘K → "Insert UUID v4", "Insert UUID v7" or "Insert ULID" puts a fresh ID at the input cursor (replacing the selection; appended on a new line if the editor wasn't used). "Generate N UUIDs…" opens a small modal to pick v4 / v7 / ULID and a count (up to 1,000), then copy the list or insert it. UUID v7 follows RFC 9562; v7 and ULID are monotonic, so IDs sort in creation order even within the same millisecond
- **Cron explainer** — ⌘K → "Explain cron expression" opens a modal prefilled from the selection, the line under the cursor or the first crontab-looking line of the input (a crontab line's command is ignored). Shows a plain-English description ("At 09:00 on Monday through Friday", "At minute 0 past every 2nd hour from 8 through 18"), the next 5 runs in local time or UTC, a per-field breakdown and preset chips, all live as you type. 5-field and 6-field (seconds first) expressions, lists, ranges, steps, `JAN`–`DEC` / `SUN`–`SAT` names, `?`, 7 = Sunday and the `@daily`-style macros (`@reboot` → "At startup"); day-of-month and day-of-week combine with OR like standard cron. Impossible dates (Feb 30) show "Never runs"; Quartz-only `L` / `W` / `#` get a clear "not supported" error
- **Python ↔ JSON** — paste a `repr(dict)` or `print(dict)` output and convert to JSON (handles `True`/`False`/`None`, single-quoted strings, tuples, sets, hex / underscored ints, triple-quoted strings); JSON → Python emits a properly indented Python literal with single quotes

**Sharing**

- **URL-only** mode — full snippet encoded into `#hash`, no backend
- **Encrypted link** mode — content is AES-GCM 256 encrypted in the browser, ciphertext stored on the server, the decryption key lives only in the URL fragment (browsers never send it). Optional password derives a second key via PBKDF2 (250k iterations) so a leaked URL alone cannot decrypt.
- **Secret mode toggle** — shorter TTL default (1h), password recommended
- **Self-destruct on read** — paste is deleted the moment the first viewer decrypts it
- **Copy as PNG** with mac-style window chrome + watermark for nice Twitter / blog snippets
- **Bookmarklet: format code from any page** — the bookmark icon in the top bar (or ⌘K → "Install bookmarklet") has a draggable **Format in Pretty Lush** button. Select code on any page and click the bookmark: it opens here in a new tab with its language detected and already formatted. Nothing selected? It sends the focused text field (never password fields), or the page's only `<pre>` / `<code>` block, else opens an empty tab. It loads no script (works on pages with a strict CSP), the snippet travels in the URL fragment (`#s=`, same format as URL-only links), and selections over 1,000,000 characters are cut with a toast saying so. On mobile, use **Copy code** and paste it as a bookmark's URL
- **Copy as Markdown code block** — wraps output in ``` ```lang ``` `` fences

**Installable PWA**

- Small install: the app shell, editor, language packs and themes are precached (~1 MB) on first visit
- Formatters (Prettier plugins, Ruff WASM ≈10 MB, sh-syntax, sql-formatter) are cached on first use — after you've used a formatter once, it works offline too
- iOS / Android "Add to Home Screen" treats it as a native app
- Service worker is `NetworkOnly` for `/api/*` so encrypted snippets are never cached

**Quality of life**

- ⌘K command palette — every action is a command, fuzzy-searchable
- Find & replace in any editor (`⌘F`), and `⌘G` selects every occurrence of the current selection / word into a multi-cursor
- Output pane fullscreen mode
- Resizable sidebar and input/output split (drag the dividers, layout persists)
- Light / dark theme with 8 popular editor themes (GitHub · Dracula · One Dark · Tokyo Night · Solarized · …)
- Works on mobile (sidebar collapses, panes stack)
- **Landing pages** — every language and tool has its own URL (`/json-formatter`, `/python-formatter`, … `/json-to-typescript`, `/json-schema-validator`, `/jwt-decoder`, `/regex-tester`, `/curl-converter`, `/cron-explainer`). Each is pre-rendered at build time with its own title, description, canonical, Open Graph / Twitter tags, JSON-LD and a short crawlable intro + FAQ, and opens the app with that language / view / tool preselected (a `#s=` / `#p=` share link still wins). Switching language updates the URL and tab title; the sidebar's **Popular tools** links to the pages, and `sitemap.xml` lists them all

---

## Stack

| Layer | Choice |
|---|---|
| Build | Vite 5 + React 18 + `vite-plugin-pwa` |
| Editor | CodeMirror 6 (`@uiw/react-codemirror`) |
| Formatters | Prettier 3 standalone · `@prettier/plugin-xml` · `@astral-sh/ruff-wasm-web` · `sh-syntax` · `sql-formatter` |
| Diff | `diff` (jsdiff) |
| JSON queries | `jsonpath-plus` |
| PNG export | `html-to-image` |
| Themes | `@uiw/codemirror-theme-*` family |
| Typography | Geist + Geist Mono (Google Fonts) |
| Backend (optional) | Vercel Functions + Vercel KV / Upstash Redis |

Initial JS: ~212 KB gzipped (entry ~32 KB + long-lived `vendor-react` / `vendor-codemirror` chunks). CodeMirror language packs, editor themes, formatters (Prettier plugins, Ruff WASM ≈10 MB, sh-syntax, sql-formatter) and the JSONPath / PNG-export libraries are lazy-loaded only when first used. Formatter chunks are emitted as `fmt-*` and kept out of the service-worker precache; they are cached at runtime (CacheFirst) instead.

---

## Getting started

```bash
git clone https://github.com/selamet/pretty-lush.git
cd pretty-lush
npm install
npm run dev      # http://localhost:5173
```

Production build:

```bash
npm run build
npm run preview  # http://localhost:4173
```

Tests (Vitest, unit tests live next to the module as `*.test.js`):

```bash
npm test             # single run, also runs in CI on every pull request
npm run test:watch   # watch mode
```

The output of `npm run build` is a fully static site in `dist/` plus the `api/` functions — drop the whole project on Vercel for a one-click deploy, or take only `dist/` to any static host (Netlify, Cloudflare Pages, S3, GitHub Pages — without the encrypted-share endpoint).

### Optional: encrypted share backend

The "encrypted link" share mode talks to two tiny serverless functions in `api/`. They use any Vercel-KV-compatible Redis (Upstash REST). Two env vars enable it:

```bash
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

- **Vercel KV** — add the integration from the project dashboard, env vars are injected automatically.
- **Upstash Redis** directly — free tier (10k commands/day, 256 MB) is plenty for personal use. Copy the REST URL and token from the Upstash console into the two env vars above.

Without these env vars:

- **Local `npm run dev`** still works — the API falls back to an in-memory map for the dev session.
- **Production** returns a clean `503` from `/api/paste`, and the share dialog automatically offers to switch to URL-only mode.

The URL-only share (`#s=...`) needs no backend and is always available.

---

## How it works

Everything runs client-side. Formatters are dynamically imported the first time their language is requested, so:

- **JSON / YAML / Markdown / CSS / HTML / JS / TS / JSX / TSX** fetch the relevant Prettier parser chunk.
- **Vue SFC** fetches Prettier's `html` + `babel` + `typescript` + `postcss` plugins together so each `<template>` / `<script>` / `<style>` block formats with its native parser.
- **JSON** is then re-serialized via `JSON.stringify` for canonical multi-line output (Prettier's `json` parser keeps short objects on one line).
- **Python** boots a Ruff WebAssembly workspace (cached for subsequent calls).
- **Shell** loads a small Go-WASM wrapper around `mvdan/sh`.
- **SQL** loads `sql-formatter`, dialect-detected from the content.
- **GraphQL** fetches Prettier's `graphql` plugin.
- **XML / SVG** fetches `@prettier/plugin-xml` (whitespace-insensitive mode, so minified XML is expanded one element per line).
- **TOML** uses an in-house tokenizer-based formatter: `key = value` / `[table]` spacing, spaced arrays and inline tables, multi-line arrays re-indented, string contents (incl. `"""` blocks) untouched, comments preserved. It reports unterminated strings / brackets with a line number.
- **INI** normalizes `key = value` (and `key: value`) spacing and `[section]` headers, separates sections with one blank line, preserves `;` / `#` comments and re-indents multi-line value continuations.
- **Dockerfile** uses an in-house heuristic (uppercase instructions, expand long `RUN … && …` chains, expand long `CMD` / `ENTRYPOINT` JSON arrays).
- **Dotenv** normalizes `KEY = value` spacing, preserves quoted values and inline `#` comments outside quotes.

WASM URLs are resolved via Vite's `?url` import so they resolve correctly in both dev and production.

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `⌘⏎` / `Ctrl+Enter` | Format |
| `⌘K` / `Ctrl+K` | Open command palette |
| `⌘F` / `Ctrl+F` | Find in editor |
| `⌘G` / `Ctrl+G` | Select all matches of current selection (multi-cursor) |
| `Esc` | Close palette / search / settings popover / dialogs / fullscreen |
| `Alt+T` / `Alt+W` | New tab / close tab (Alt = Option on macOS; `⌘T` / `⌘W` belong to the browser) |
| `Alt+Shift+T` | Reopen the last closed tab |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | Next / previous tab (where the browser lets the page see it, e.g. the installed PWA) |
| `Alt+1` … `Alt+8`, `Alt+9` | Go to tab 1…8, last tab |
| `F2` | Rename the active tab |
| `←` `→` `Home` `End` · `Alt+Shift+←/→` (`⌘⌥←/→`) · `Delete` | With a tab focused: switch · move · close |

The ⌘K palette is the canonical surface — every formatter, theme, text utility, view-mode switch and share action is reachable from there. Use it as a discovery tool: type `jwt`, `base64`, `sort`, `compare`, `dracula`, `secret`…

---

## Project structure

```
pretty-lush/
├── public/                          # static assets (og.svg, robots.txt)
├── api/                             # Vercel serverless functions
│   ├── _store.js                    # KV / in-memory storage adapter
│   ├── paste.js                     # POST — store encrypted paste
│   └── paste/[id].js                # GET  — retrieve (and DEL if burnAfterRead)
├── src/
│   ├── main.jsx                     # React entry
│   ├── App.jsx                      # thin shell — format state + wiring hooks to components
│   ├── styles.css                   # all styling, light + dark + theme overrides
│   ├── editor-themes.js             # editor theme registry + flipTheme helper
│   ├── commands/                    # ⌘K palette
│   │   ├── index.js                  #   buildCommands(ctx) — pure, returns the palette list
│   │   └── text-tools.js             #   declarative input → output tools + tool-modal tools
│   ├── components/                  # React UI, one component per file
│   │   ├── TopBar · Toolbar · SettingsPopover · SuggestionBanner · StatusBar
│   │   ├── Sidebar · RecentHistory   #   language list + recent formats
│   │   ├── InputPane · OutputPane · DiffPane · ComparePanes · RegexPanes
│   │   ├── CopyButton · DownloadButton · ImageButton · FullscreenButton · CopyMarkdownButton
│   │   ├── ErrorCard · JsonTree · JsonTable · DiffView · CodeEditor · Resizer
│   │   ├── ImportConfigDialog        #   paste / drop a formatter config, review, apply
│   │   ├── CommandPalette · ShareDialog · JwtModal · HashModal · IdsModal · CronModal · ToolModalHost (tool-modal registry)
│   │   └── Toast · DropOverlay · BrandMark
│   ├── hooks/                       # stateful logic, no markup
│   │   ├── usePersistentState.js     #   useState mirrored to localStorage
│   │   ├── useSettings.js            #   settings + theme chrome (data-theme, CSS vars)
│   │   ├── useProfiles.js            #   named settings profiles on top of useSettings
│   │   ├── useTabs.js                #   snippet tabs: active tab's language, inputs, output + view state
│   │   ├── useHistory.js · useLayout.js · useCompareSnippets.js · useRegexTester.js
│   │   ├── useShare.js               #   share dialog, link creation, #s= / #p= loading
│   │   └── useToast.js · useLanguageSuggestion.js · useFileDrop.js · useWindowKeydown.js
│   ├── state/                       # pure persistence + domain logic (unit-tested)
│   │   ├── storage.js                #   STORAGE_KEYS + safe localStorage helpers
│   │   ├── profiles.js               #   settings profiles: load / migrate, save, switch, rename, delete
│   │   └── settings.js · workspace.js · tabs.js · history.js · layout.js
│   ├── config-import/               # .prettierrc / package.json / .editorconfig / ruff.toml / pyproject.toml → settings patch + summary
│   ├── convert/                     # data converters (JSON ↔ YAML ↔ TOML ↔ CSV, RFC 4180 CSV)
│   ├── codegen/                     # JSON → TypeScript / Zod / Pydantic (schema inference + emitters)
│   ├── curl/                        # cURL → fetch / axios / requests (shell tokenizer, flag parser, emitters)
│   ├── schema/                      # JSON Schema validation (lazy Ajv), JSON pointer → source offset, schema generation
│   ├── cron/                        # Cron explainer: parser, plain-English description, next-run search (pure)
│   ├── regex/                       # Regex tester: pure match model + worker protocol, worker runner with timeout, CodeMirror highlights
│   ├── output/                      # pure output helpers (JSON tree model + search, JSONPath build / parse, table, filenames)
│   ├── formatters/                  # one module per backend; index.js dispatches
│   ├── languages/                   # registry, detection, sidebar groups, CodeMirror modes
│   ├── share/                       # AES-GCM crypto + URL-fragment encode / decode
│   ├── bookmarklet/                 # bookmarklet builder (javascript: URL for an origin) + payload reader
│   ├── seo/                         # landing pages: route table (routes.js) + build-time HTML / sitemap.xml generator (render.js)
│   └── text-utils/                  # pure string transforms used by ⌘K tools
├── index.html                       # title / meta / OG / PWA tags
├── vite.config.js                   # vite + react + PWA config
└── package.json
```

Common changes stay local:

- **New palette command** — an input → output transform is one entry in `src/commands/text-tools.js` (`transform` + `toast`); any other command is one entry in `buildCommands` (`src/commands/index.js`) plus, if it needs new behaviour, a callback in the `actions` object App passes in.
- **New tool modal** (e.g. a decoder that shows a dialog) — add the component in `src/components/`, register it in `TOOL_MODALS` in `ToolModalHost.jsx`, and add a `text-tools.js` entry with `modal`, `decode` and `emptyMessage` (or `allowEmpty`).
- **New language** — write `src/formatters/<lang>.js`, add a case to `src/formatters/index.js`, and register the entry in `src/languages/registry.js` + a lazy loader in `src/languages/codemirror.js`. The sidebar, mobile picker and palette pick it up automatically. Add its landing-page copy to `LANGUAGE_COPY` in `src/seo/routes.js` (a test fails until you do); the page and sitemap entry are generated at build.
- **New landing page** — one entry in `TOOL_ROUTES` (`src/seo/routes.js`) with unique title / description / intro, plus a `case` for its `tool` in `applyLandingRoute` (`App.jsx`). `npm run build` writes `dist/<slug>/index.html` and the sitemap.
- **New persisted setting** — add the default to `DEFAULT_SETTINGS` in `src/state/settings.js`; stored settings are merged over defaults, so existing users get it too. If it shapes formatter output, also list it in `FORMAT_SETTING_KEYS` so profiles store it and auto-format reacts to it.

State is stored in `localStorage` (keys live in `src/state/storage.js` and must never be renamed):

- `pretty-lush:state:v1` — current language + per-language inputs
- `pretty-lush:settings:v1` — indent, line width, quotes, Prettier / Python options, editor theme, auto-format, format-on-paste
- `pretty-lush:profiles:v1` — named settings profiles + the active one
- `pretty-lush:history:v1` — recent format entries
- `pretty-lush:layout:v1` — sidebar width + input/output split ratio
- `pretty-lush:compare:v1` — Compare mode A / B bodies
- `pretty-lush:regex:v1` — Regex tester pattern, flags and replacement
- `pretty-lush:theme` — last applied light/dark mode (for chrome)

---

## Privacy

This is a static SPA. Source code you paste lives in your tab — it is never sent to any server controlled by this project, including for analytics. The privacy pill in the top bar (`runs in your browser`) is literal: every formatter is local.

The optional **encrypted share link** is the only feature that talks to a backend. Even then the snippet is AES-GCM encrypted in the browser before upload and the decryption key never leaves the URL fragment (which browsers never send to servers). With a password, a second key is derived via PBKDF2 (250k iterations) and combined with the random key, so a leaked URL alone cannot decrypt. With **self-destruct on read**, the ciphertext is deleted from the server the moment it is first decrypted — even the encrypted blob doesn't outlive the first viewer.

---

## Contributing

Issues, language requests, formatter tweaks, theme PRs all welcome. The codebase is small (see [Project structure](#project-structure)). Pure modules (formatters, text utilities, language detection, URL share, persisted state, palette commands) have Vitest unit tests — add one next to any module you touch, run `npm test`, then `npm run dev`, edit, refresh. Ship.

---

## License

MIT.
