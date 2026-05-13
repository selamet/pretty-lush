# pretty-lush

A fast, private code formatter that runs **entirely in your browser**. Paste code, hit Format, copy the result. No uploads, no accounts, no telemetry.

Live: **<https://pretty-lush.selamet.dev>**

Powered by real formatters compiled to WebAssembly or pure JavaScript:

- **Prettier** — JSON · YAML · Markdown · CSS · HTML · JavaScript · TypeScript · JSX · TSX · Vue SFC
- **Ruff** — Python (black-compatible)
- **sh-syntax** — Shell / Bash
- **sql-formatter** — SQL (Postgres / MySQL / SQLite / BigQuery / …)
- Built-in heuristics — Dockerfile, Dotenv

---

## Highlights

**Formatter**

- 15 languages out of the box: Python · JSON · YAML · Shell · Dockerfile · JavaScript · TypeScript · JSX · TSX · Vue SFC · HTML · CSS · Markdown · Dotenv · SQL
- Auto-detect language from pasted content or dropped files
- Drag-and-drop a file to load it (extension picks the language)
- Side-by-side editor with syntax highlighting (CodeMirror 6)
- Inline diff view between input and output
- Configurable indent (2 / 4 / tab), line width, quote style
- Auto-format on type (debounced) and Format-on-paste options
- Local format history (last 20, click to restore)

**JSON power tools**

- **JSONPath filter** — type an expression (`$.items[*].id`, `$..name`) in the JSON pane and the formatted output is the matched values
- **Table view** — when output is an array of objects, toggle between Code and a sticky-header table

**Compare mode**

- A standalone two-snippet diff (A vs B) with its own pair of editors, live diff below, Swap and Clear actions
- Both bodies persist across reloads

**Text utilities (⌘K palette)**

- Lines: Sort A→Z / Z→A, Dedupe, Reverse, Trim trailing whitespace, Collapse blank lines
- Case: UPPERCASE · lowercase · Title Case
- Encoding: Base64 / URL percent / Hex — encode & decode in both directions
- **JWT decoder** with a small modal showing header, payload, signature, issued/expires meta and an `expired` badge
- Unix timestamp ↔ ISO date
- **Python ↔ JSON** — paste a `repr(dict)` or `print(dict)` output and convert to JSON (handles `True`/`False`/`None`, single-quoted strings, tuples, sets, hex / underscored ints, triple-quoted strings); JSON → Python emits a properly indented Python literal with single quotes

**Sharing**

- **URL-only** mode — full snippet encoded into `#hash`, no backend
- **Encrypted link** mode — content is AES-GCM 256 encrypted in the browser, ciphertext stored on the server, the decryption key lives only in the URL fragment (browsers never send it). Optional password derives a second key via PBKDF2 (250k iterations) so a leaked URL alone cannot decrypt.
- **Secret mode toggle** — shorter TTL default (1h), password recommended
- **Self-destruct on read** — paste is deleted the moment the first viewer decrypts it
- **Copy as PNG** with mac-style window chrome + watermark for nice Twitter / blog snippets
- **Copy as Markdown code block** — wraps output in ``` ```lang ``` `` fences

**Installable PWA**

- Works fully offline after first load — all formatters precached, including the ~10 MB Ruff WASM
- iOS / Android "Add to Home Screen" treats it as a native app
- Service worker is `NetworkOnly` for `/api/*` so encrypted snippets are never cached

**Quality of life**

- ⌘K command palette — every action is a command, fuzzy-searchable
- Find & replace in any editor (`⌘F`), and `⌘G` selects every occurrence of the current selection / word into a multi-cursor
- Output pane fullscreen mode
- Resizable sidebar and input/output split (drag the dividers, layout persists)
- Light / dark theme with 8 popular editor themes (GitHub · Dracula · One Dark · Tokyo Night · Solarized · …)
- Works on mobile (sidebar collapses, panes stack)

---

## Stack

| Layer | Choice |
|---|---|
| Build | Vite 5 + React 18 + `vite-plugin-pwa` |
| Editor | CodeMirror 6 (`@uiw/react-codemirror`) |
| Formatters | Prettier 3 standalone · `@astral-sh/ruff-wasm-web` · `sh-syntax` · `sql-formatter` |
| Diff | `diff` (jsdiff) |
| JSON queries | `jsonpath-plus` |
| PNG export | `html-to-image` |
| Themes | `@uiw/codemirror-theme-*` family |
| Typography | Geist + Geist Mono (Google Fonts) |
| Backend (optional) | Vercel Functions + Vercel KV / Upstash Redis |

Initial JS bundle: ~310 KB gzipped. Heavy formatters (Ruff WASM ≈10 MB, sh-syntax) and the JSONPath / PNG-export libraries are lazy-loaded only when first used.

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

The ⌘K palette is the canonical surface — every formatter, theme, text utility, view-mode switch and share action is reachable from there. Use it as a discovery tool: type `jwt`, `base64`, `sort`, `compare`, `dracula`, `secret`…

---

## Project layout

```
pretty-lush/
├── public/                          # static assets (og.svg, robots, sitemap)
├── api/                             # Vercel serverless functions
│   ├── _store.js                    # KV / in-memory storage adapter
│   ├── paste.js                     # POST — store encrypted paste
│   └── paste/[id].js                # GET  — retrieve (and DEL if burnAfterRead)
├── src/
│   ├── main.jsx                     # React entry
│   ├── App.jsx                      # main shell — state, topbar, sidebar, panes, palette wiring
│   ├── styles.css                   # all styling, light + dark + theme overrides
│   ├── editor-themes.js             # editor theme registry + flipTheme helper
│   │
│   ├── components/                  # React UI building blocks
│   │   ├── CodeEditor.jsx            #   CodeMirror wrapper + multi-cursor + match-count
│   │   ├── CommandPalette.jsx        #   ⌘K palette
│   │   ├── CopyMarkdownButton.jsx    #   copy output as fenced code block
│   │   ├── DiffView.jsx              #   input ↔ output line diff
│   │   ├── JwtModal.jsx              #   modal that renders a decoded JWT
│   │   ├── Resizer.jsx               #   drag handle for layout splits
│   │   └── ShareDialog.jsx           #   share modal + password prompt + toggles
│   │
│   ├── formatters/                  # one module per backend; index.js dispatches
│   │   ├── index.js                  #   formatCode(lang, src, opts) + FormatError re-export
│   │   ├── errors.js                 #   FormatError + Prettier / Ruff / sh error mappers
│   │   ├── helpers.js                #   shared structural helpers
│   │   ├── prettier.js               #   Prettier standalone + lazy-loaded plugins
│   │   ├── json.js                   #   JSON.parse + JSONPath + JSON.stringify
│   │   ├── python.js                 #   Ruff WASM workspace
│   │   ├── shell.js                  #   sh-syntax / mvdan-sh WASM
│   │   ├── sql.js                    #   sql-formatter
│   │   ├── dockerfile.js             #   in-house heuristic
│   │   └── dotenv.js                 #   in-house heuristic
│   │
│   ├── languages/                   # single source of truth for "what languages exist"
│   │   ├── registry.js               #   LANGUAGES, SAMPLES, EXT_TO_LANG, MARKDOWN_LANG_TAGS
│   │   ├── detect.js                 #   detectLangFromContent / detectLangFromFilename
│   │   └── codemirror.js             #   LANG_MAP for CodeMirror 6
│   │
│   ├── share/                       # everything that talks to the share backend
│   │   ├── crypto.js                 #   AES-GCM 256 + optional PBKDF2-derived password key
│   │   └── url-share.js              #   URL-fragment encode / decode helpers
│   │
│   └── text-utils/                  # pure string transforms used by the ⌘K palette
│       ├── index.js                  #   barrel for ergonomic imports
│       ├── lines.js                  #   sort, dedupe, reverse, trim, collapse
│       ├── case.js                   #   upper / lower / title
│       ├── encoding.js               #   base64 / url-percent / hex (both directions)
│       ├── jwt.js                    #   decodeJwt
│       ├── timestamp.js              #   unix ↔ ISO
│       └── python-json.js            #   Python literal ↔ JSON converter
├── index.html                       # title / meta / OG / PWA tags
├── vite.config.js                   # vite + react + PWA config
└── package.json
```

Adding a new language is a focused, three-file change: write `src/formatters/<lang>.js`, add a case to `src/formatters/index.js`, and register the entry in `src/languages/registry.js` + `src/languages/codemirror.js`.

State is stored in `localStorage`:

- `pretty-lush:state:v1` — current language + per-language inputs
- `pretty-lush:settings:v1` — indent, line width, quotes, editor theme, auto-format, format-on-paste
- `pretty-lush:history:v1` — recent format entries
- `pretty-lush:layout:v1` — sidebar width + input/output split ratio
- `pretty-lush:compare:v1` — Compare mode A / B bodies
- `pretty-lush:theme` — last applied light/dark mode (for chrome)

---

## Privacy

This is a static SPA. Source code you paste lives in your tab — it is never sent to any server controlled by this project, including for analytics. The privacy pill in the top bar (`runs in your browser`) is literal: every formatter is local.

The optional **encrypted share link** is the only feature that talks to a backend. Even then the snippet is AES-GCM encrypted in the browser before upload and the decryption key never leaves the URL fragment (which browsers never send to servers). With a password, a second key is derived via PBKDF2 (250k iterations) and combined with the random key, so a leaked URL alone cannot decrypt. With **self-destruct on read**, the ciphertext is deleted from the server the moment it is first decrypted — even the encrypted blob doesn't outlive the first viewer.

---

## Contributing

Issues, language requests, formatter tweaks, theme PRs all welcome. The codebase is small (one App component, a handful of helpers) and intentionally has no test framework — keeping the loop tight matters more than coverage here. Run `npm run dev`, edit, refresh. Ship.

---

## License

MIT.
