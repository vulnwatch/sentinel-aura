import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

// The script that applies the stored theme before the page renders
// (src/theme-script.ts; docs/behaviors.md, Preferences). The build emits it as
// a file of its own, and the entry document loads it as a classic script, a
// script file of the UI's origin under the unchanged Content Security Policy
// (docs/architecture.md, Security Headers). It runs right after the meta
// element of the color schemes, before the stylesheet and the application
// load, and sets that element to the stored theme, which the browser uses for
// the blank page until the stylesheet arrives. A classic script cannot import
// or export, so the build fails when the emitted file does either. It also
// fails when the entry document lacks that meta element.
const THEME_SCRIPT = "src/theme-script.ts";
const COLOR_SCHEME_META = /<meta name="color-scheme" content="light dark" \/>/;

function themeScript(): Plugin {
  let root = "";
  let base = "/";
  let command = "";
  return {
    name: "sentinel-aura:theme-script",
    configResolved(config) {
      root = config.root;
      base = config.base;
      command = config.command;
    },
    buildStart() {
      if (command === "build") {
        this.emitFile({
          type: "chunk",
          id: resolve(root, THEME_SCRIPT),
          name: "theme-script",
        });
      }
    },
    transformIndexHtml: {
      order: "post",
      handler(html, { filename, bundle }) {
        // Only the entry document, not the pages of the unit tests.
        if (resolve(filename) !== resolve(root, "index.html")) {
          return html;
        }
        if (!COLOR_SCHEME_META.test(html)) {
          throw new Error(
            'index.html has no <meta name="color-scheme" content="light dark" />, after which the theme script runs',
          );
        }
        let src = `/${THEME_SCRIPT}`;
        if (bundle) {
          const script = resolve(root, THEME_SCRIPT);
          const chunk = Object.values(bundle).find(
            (file) => file.type === "chunk" && file.facadeModuleId === script,
          );
          if (chunk?.type !== "chunk") {
            throw new Error(`the build has no file of ${THEME_SCRIPT}`);
          }
          if (
            chunk.imports.length > 0 ||
            chunk.dynamicImports.length > 0 ||
            chunk.exports.length > 0
          ) {
            throw new Error(
              `${THEME_SCRIPT} runs as a classic script, so it must import and export nothing`,
            );
          }
          src = `${base}${chunk.fileName}`;
        }
        return html.replace(
          COLOR_SCHEME_META,
          (meta) => `${meta}\n    <script src="${src}"></script>`,
        );
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), themeScript()],
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
      // lcov.info, which lcovonly writes, is the report that CI uploads to
      // Codecov, which reads every branch of it as Istanbul counts it
      // (docs/deployment.md, Workflow Inventory, Coverage reporting).
      reporter: ["text", "html", "lcovonly"],
      // A subdirectory, because Vitest removes and recreates the reports
      // directory, and coverage/ is a mount point in the tooling container.
      reportsDirectory: "coverage/unit",
    },
  },
});
