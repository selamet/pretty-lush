import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["og.svg"],
      manifest: {
        name: "pretty-lush — in-browser code formatter",
        short_name: "pretty-lush",
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
        globPatterns: ["**/*.{js,css,html,svg,wasm,woff2}"],
        // The Ruff and sh-syntax WASM bundles are ~10 MB and ~785 KB —
        // bump the limit so they get precached for offline use.
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        navigateFallback: "/index.html",
        runtimeCaching: [
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
  server: { port: 5173 },
});
