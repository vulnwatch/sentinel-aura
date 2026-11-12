import { availableParallelism } from "node:os";
import { defineConfig, devices } from "@playwright/test";

// The end-to-end tests (docs/architecture.md, Static Checks and Tests). Each
// project runs in the network namespace of a container, which serves the UI
// on its baseURL: the projects of the browsers in the one of the reverse
// proxy of an end-to-end environment, where the UI's production image and
// Sentinel's API share the origin http://localhost:8080
// (`scripts/dev-env.sh e2e`); dev-server in the one of the development server
// of a local backend (`scripts/dev-env.sh test`); and image in the one of a
// container of the UI's image alone (`scripts/image.sh test`).

// The viewport of every test, and so of every reference screenshot.
const VIEWPORT = { width: 1280, height: 800 };
// The workers of a run: the tests of a browser run at the same time against
// its backend (docs/conventions.md, End-to-End Tests), and both browsers run
// at the same time (`scripts/dev-env.sh e2e`), so each takes half of the
// cores of the host, at most 4, beyond which the backend that its tests share
// limits the gain more than the cores do. --workers overrides it.
const WORKERS = Math.min(
  4,
  Math.max(1, Math.floor(availableParallelism() / 2)),
);
// The modules of the projects that check how the UI is served: the same
// origin of the UI and the API, and the UI's image.
const SAME_ORIGIN = "**/same-origin.spec.ts";
const IMAGE = "**/image.spec.ts";

export default defineConfig({
  testDir: "test/e2e",
  // A reference is named after the screen and state that it shows, never
  // after the test or its file (docs/conventions.md, End-to-End Tests).
  snapshotPathTemplate: "{testDir}/screenshots/{arg}{ext}",
  // A missing or different reference fails the test; scripts/dev-env.sh
  // update-screenshots writes them.
  updateSnapshots: "none",
  // Each project runs separately and keeps its own results: Playwright clears
  // the output directory of a project when it runs it, and
  // scripts/tooling.sh e2e names the report directory of each project.
  reporter: [
    ["list"],
    ["html", { outputFolder: "test-results/e2e/report", open: "never" }],
  ],
  forbidOnly: true,
  retries: 0,
  // Each browser has its own backend, and its tests share it at the same time,
  // those of one module too (docs/conventions.md, End-to-End Tests).
  workers: WORKERS,
  fullyParallel: true,
  use: {
    baseURL: "http://localhost:8080",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // scripts/dev-env.sh e2e selects the project named after each browser.
  // Tests that change data that a screen shows belong to it, and it then
  // depends on a project of the browser's other tests, with the same output
  // directory (docs/conventions.md, End-to-End Tests).
  projects: [
    {
      name: "chromium",
      testIgnore: IMAGE,
      outputDir: "test-results/e2e/chromium/output",
      use: { ...devices["Desktop Chrome"], viewport: VIEWPORT },
    },
    {
      // The references are Chromium's: Firefox renders text differently.
      name: "firefox",
      testIgnore: IMAGE,
      outputDir: "test-results/e2e/firefox/output",
      use: { ...devices["Desktop Firefox"], viewport: VIEWPORT },
      ignoreSnapshots: true,
    },
    {
      // The port of the development server: keep in sync with
      // vite.config.ts.
      name: "dev-server",
      testMatch: SAME_ORIGIN,
      outputDir: "test-results/e2e/dev-server/output",
      use: {
        ...devices["Desktop Chrome"],
        viewport: VIEWPORT,
        baseURL: "http://localhost:5173",
      },
    },
    {
      // The port on which the image's nginx listens: keep in sync with
      // nginx/default.conf.
      name: "image",
      testMatch: IMAGE,
      outputDir: "test-results/e2e/image/output",
      use: {
        ...devices["Desktop Chrome"],
        viewport: VIEWPORT,
        baseURL: "http://localhost:8080",
      },
    },
  ],
});
