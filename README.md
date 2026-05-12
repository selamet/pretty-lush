# pretty-lush

A fast, private code formatter that runs **entirely in your browser**. Paste code, hit Format, copy the result. No uploads, no accounts, no telemetry.

Powered by real formatters compiled to WebAssembly:

- **Prettier** — JSON, YAML, Markdown, CSS, HTML, JavaScript, TypeScript
- **Ruff** — Python (black-compatible)
- **sh-syntax** — Shell / Bash
- **sql-formatter** — SQL (Postgres/MySQL/SQLite/etc.)
- Built-in heuristic — Dockerfile, Dotenv

---

## Highlights

- 12 languages out of the box: Python · JSON · YAML · Shell · Dockerfile · JavaScript · TypeScript · HTML · CSS · Markdown · Dotenv · SQL
- Installable PWA — works fully offline after first load (formatters are precached, including the Ruff WASM)
- Export formatted output as a PNG card with window chrome + watermark
- Side-by-side editor with syntax highlighting (CodeMirror 6)
- Inline diff view between input and output
- Auto-detect language from pasted content or dropped files
- Drag-and-drop a file to load it (extension picks the language)
- Download the formatted output with the right extension
- Local format history (last 20, click to restore)
- Two share modes: URL-only (state in `#hash`) or short encrypted link backed by Vercel KV with optional password and TTL — content is AES-GCM encrypted in the browser, the decryption key lives only in the URL fragment
- Light + dark mode plus 8 popular editor themes (GitHub, Dracula, One Dark, Tokyo Night, Solarized)
- ⌘K command palette — every action is a command
- Configurable indent (2 / 4 / tab), line width, quote style
- Auto-format on type (debounced)
- Works on mobile (sidebar collapses, panes stack)

---

## Stack

| Layer | Choice |
|---|---|
| Build | Vite 5 + React 18 |
| Editor | CodeMirror 6 (`@uiw/react-codemirror`) |
| Formatters | Prettier 3 standalone · `@astral-sh/ruff-wasm-web` · `sh-syntax` |
| Diff | `diff` (jsdiff) |
| Themes | `@uiw/codemirror-theme-*` family |
| Typography | Geist + Geist Mono (Google Fonts) |

Initial JS bundle: ~300 KB gzipped. Heavy formatters (Ruff WASM ≈10 MB, sh-syntax) are lazy-loaded only when their language is used.

---

Live: **<https://pretty-lush.selamet.dev>**

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

The output of `npm run build` is a fully static site in `dist/` — drop it on any static host (Vercel, Netlify, Cloudflare Pages, S3, GitHub Pages).

### Optional: encrypted share backend

The "encrypted link" share mode talks to two tiny serverless functions in `api/`. They use any Vercel KV–compatible Redis (Upstash REST). Two env vars enable it:

```bash
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

- **Vercel KV** — add the integration from the project dashboard, env vars are injected automatically.
- **Upstash Redis** directly — free tier (10k commands/day, 256 MB) is enough for personal use. Copy the REST URL and token from the Upstash console into the two env vars above.

Without these env vars:
- **Local `npm run dev`** still works — the API falls back to an in-memory map for the dev session.
- **Production** returns a clean `503` from `/api/paste`, and the share dialog automatically offers to switch to URL-only mode.

The URL-only share (`#s=...`) needs no backend and is always available.

---

## How it works

Everything runs client-side. Formatters are dynamically imported the first time their language is requested, so:

- Picking **JSON / YAML / Markdown / CSS / HTML / JS / TS** fetches the relevant Prettier parser chunk.
- Picking **Python** boots a Ruff WebAssembly workspace (cached for subsequent calls).
- Picking **Shell** loads a small Go-WASM wrapper around `mvdan/sh`.
- Picking **Dockerfile** uses a small in-house heuristic (uppercase instructions, expand long `RUN ... && ...` chains, expand long `CMD` / `ENTRYPOINT` JSON arrays).

WASM URLs are resolved via Vite's `?url` import so they resolve correctly in both dev and production.

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `⌘⏎` / `Ctrl+Enter` | Format |
| `⌘K` / `Ctrl+K` | Open command palette |
| `Esc` | Close palette / settings popover |

---

## Project layout

```
pretty-lush/
├── public/                  # static assets (og.svg, robots, sitemap)
├── api/                     # Vercel serverless functions
│   ├── paste.js             # POST — store encrypted paste in Vercel KV
│   └── paste/[id].js        # GET  — retrieve encrypted paste
├── src/
│   ├── App.jsx              # main shell — state, topbar, sidebar, panes
│   ├── CodeEditor.jsx       # CodeMirror wrapper + themes + error decorations
│   ├── DiffView.jsx         # input ↔ output line diff
│   ├── CommandPalette.jsx   # ⌘K palette
│   ├── ShareDialog.jsx      # share modal + password prompt
│   ├── crypto.js            # AES-GCM 256 + optional PBKDF2 password
│   ├── formatters.js        # language → formatter dispatch (Prettier / Ruff / shfmt / heuristic)
│   ├── themes.js            # editor theme registry + flipTheme helper
│   └── styles.css           # all styling, light + dark + theme overrides
├── index.html               # title / meta / OG / favicon
├── package.json
└── vite.config.js
```

State is stored in `localStorage`:

- `pretty-lush:state:v1` — current language + per-language inputs
- `pretty-lush:settings:v1` — indent, line width, quotes, editor theme, auto-format
- `pretty-lush:history:v1` — recent format entries
- `pretty-lush:theme` — last applied light/dark mode (for chrome)

---

## Privacy

This is a static SPA. Source code you paste lives in your tab — it is never sent to any server controlled by this project, including for analytics. The privacy pill in the top bar (`🔒 runs in your browser`) is literal: every formatter is local.

The optional **encrypted share link** is the only feature that talks to a backend. Even then the snippet is AES-GCM encrypted in the browser before upload and the decryption key never leaves the URL fragment (which browsers never send to servers). With a password, a second key is derived via PBKDF2 (250k iterations) and combined with the random key, so a leaked URL alone cannot decrypt.

---

## License

MIT.
