import { defineConfig, devices } from "@playwright/test";

// The end-to-end tests (docs/architecture.md, Static Checks and Tests). They
// run in the network namespace of the reverse proxy of an end-to-end
// environment, where the UI's production image and Sentinel's API share the
// origin http://localhost:8080; run them with `scripts/dev-env.sh e2e`.

// The viewport of every test, and so of every reference screenshot.
const VIEWPORT = { width: 1280, height: 800 };

export default defineConfig({
  testDir: "test/e2e",
  // A reference is named after the screen and state that it shows, never
  // after the test or its file (docs/conventions.md, End-to-End Tests).
  snapshotPathTemplate: "{testDir}/screenshots/{arg}{ext}",
  // A missing or different reference fails the test; scripts/dev-env.sh
  // update-screenshots writes them.
  updateSnapshots: "none",
  outputDir: "test-results/e2e/output",
  reporter: [
    ["list"],
    ["html", { outputFolder: "test-results/e2e/report", open: "never" }],
  ],
  forbidOnly: true,
  retries: 0,
  // Each browser has its own backend, and its tests share it one at a time
  // (docs/conventions.md, End-to-End Tests).
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: "http://localhost:8080",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: VIEWPORT },
    },
    {
      // The references are Chromium's: Firefox renders text differently.
      name: "firefox",
      use: { ...devices["Desktop Firefox"], viewport: VIEWPORT },
      ignoreSnapshots: true,
    },
  ],
});
