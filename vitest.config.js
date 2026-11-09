// Kept separate from vite.config.js so the PWA plugin never runs under test.
// All covered modules are pure and run in plain Node; opt into a DOM per file
// with a `// @vitest-environment jsdom` docblock if one is ever needed.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{js,jsx}"],
  },
});
