# pretty-lush

A fast, private code formatter that runs **entirely in your browser**. Paste code, hit Format, copy the result. No uploads, no accounts, no telemetry.

Powered by real formatters compiled to WebAssembly:

- **Prettier** — JSON, YAML, Markdown, CSS, HTML, JavaScript, TypeScript
- **Ruff** — Python (black-compatible)
- **sh-syntax** — Shell / Bash
- Built-in heuristic — Dockerfile

---

## Highlights

- 10 languages out of the box: Python · JSON · YAML · Shell · Dockerfile · JavaScript · TypeScript · HTML · CSS · Markdown
- Side-by-side editor with syntax highlighting (CodeMirror 6)
- Inline diff view between input and output
- Auto-detect language from pasted content or dropped files
- Drag-and-drop a file to load it (extension picks the language)
- Download the formatted output with the right extension
- Local format history (last 20, click to restore)
- Shareable URL (state encoded in `#hash`, never sent to a server)
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
├── src/
│   ├── App.jsx              # main shell — state, topbar, sidebar, panes
│   ├── CodeEditor.jsx       # CodeMirror wrapper + themes + error decorations
│   ├── DiffView.jsx         # input ↔ output line diff
│   ├── CommandPalette.jsx   # ⌘K palette
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

---

## License

MIT.
