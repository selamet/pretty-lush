import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Heavy formatter code is emitted under a stable `fmt-` prefix so the service
// worker can leave it out of the install-time precache (see globIgnores) and
// cache it at runtime on first use instead.
const FORMATTER_CHUNKS = [
  [/node_modules\/prettier\/plugins\/([\w-]+)/, (m) => `fmt-prettier-${m[1]}`],
  [/node_modules\/prettier\/standalone/, () => "fmt-prettier"],
  // @prettier/plugin-xml pulls in prettier/doc and the chevrotain-based
  // @xml-tools/parser; keep all of it in one lazily cached chunk.
  [
    /node_modules\/(@prettier\/plugin-xml|@xml-tools|chevrotain|regexp-to-ast)\/|node_modules\/prettier\/doc/,
    () => "fmt-xml",
  ],
  [/node_modules\/sql-formatter\//, () => "fmt-sql"],
  [/node_modules\/sh-syntax\//, () => "fmt-shell"],
  [/node_modules\/@astral-sh\/ruff-wasm-web\//, () => "fmt-ruff"],
  // Data converters (src/convert/): YAML and TOML parser/stringifiers.
  [/node_modules\/yaml\//, () => "fmt-yaml"],
  [/node_modules\/smol-toml\//, () => "fmt-toml"],
];

// Long-lived vendor chunks: they change far less often than app code, so
// returning visitors keep them cached across deploys.
const VENDOR_CHUNKS = [
  [/node_modules\/(react|react-dom|scheduler)\//, "vendor-react"],
  [
    /node_modules\/(@codemirror\/(state|view|language|commands|search|autocomplete|lint)|@uiw\/react-codemirror|@uiw\/codemirror-extensions-basic-setup|@lezer\/(common|highlight)|style-mod|w3c-keyname|crelt)\//,
    "vendor-codemirror",
  ],
];

function manualChunks(id) {
  for (const [re, name] of FORMATTER_CHUNKS) {
    const m = id.match(re);
    if (m) return name(m);
  }
  for (const [re, name] of VENDOR_CHUNKS) {
    if (re.test(id)) return name;
  }
  return undefined;
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["og.svg"],
      manifest: {
        name: "Pretty Lush — in-browser code formatter",
        short_name: "Pretty Lush",
        description:
          "Format Python, JSON, YAML, SQL, Shell, Dockerfile, JSX/TSX and Vue in your browser. Powered by Prettier, Ruff and friends.",
        theme_color: "#1f6f4a",
        background_color: "#fbfbf9",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/og.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        // WASM (Ruff ~10 MB, sh-syntax ~785 KB) and the large formatter
        // chunks are not precached on install; the "formatters" runtime
        // cache below stores them on first use so they work offline after.
        globIgnores: ["**/*.wasm", "**/fmt-*.js"],
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            // Formatter chunks and WASM excluded from precache above. File
            // names are content-hashed, so CacheFirst never serves stale code.
            // (Inlined: workbox serializes this function into sw.js, so it
            // must not reference outer-scope helpers.)
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin &&
              /^\/assets\/(fmt-[\w-]+\.js|[\w.-]+\.wasm)$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "formatters",
              expiration: {
                maxEntries: 40,
                maxAgeSeconds: 60 * 60 * 24 * 90,
              },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.origin === "https://fonts.googleapis.com" ||
              url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Never cache API responses — they hold encrypted secrets.
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: { manualChunks },
    },
  },
  server: { port: 5173 },
});
