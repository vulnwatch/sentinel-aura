import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The development server of docs/architecture.md (Local Development): one
  // origin for the UI and the API, as on the Sentinel host.
  server: {
    port: 5173,
    strictPort: true,
    // No CORS: Vite's CORS middleware runs before the proxy, so it would
    // answer preflight requests and add CORS headers to the API's responses.
    cors: false,
    proxy: {
      // /api and every path under it, matched by whole path segment: Vite
      // tests the expression against the request URL, query included, so
      // /apidocs and /api-keys stay with the UI. The path is forwarded
      // unchanged to the API of the backend that scripts/dev-env.sh starts.
      "^/api(/|\\?|$)": {
        target: "http://sentinel:8000",
        // Forward the Host header unchanged, with Origin and Sec-Fetch-Site,
        // which Sentinel's cross-origin request protection reads.
        changeOrigin: false,
      },
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    // Holds the screenshots of failed tests, among other attachments.
    attachmentsDir: "test-results/vitest",
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: "chromium" }, { browser: "firefox" }],
    },
    coverage: {
      provider: "istanbul",
      include: ["src/**/*.{ts,tsx}"],
      // The generated API client: its requests are tested through the shared
      // request function, and its other code belongs to its generator.
      exclude: ["src/api/generated/**"],
      // clover.xml is the report that CI uploads to Codecov.
      reporter: ["text", "html", "clover"],
      // A subdirectory, because Vitest removes and recreates the reports
      // directory, and coverage/ is a mount point in the tooling container.
      reportsDirectory: "coverage/unit",
    },
  },
});
