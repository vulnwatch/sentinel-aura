import { availableParallelism } from "node:os";
import { defineConfig, devices, type Project } from "@playwright/test";

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
// at the same time, each with its backend (`scripts/dev-env.sh e2e`), so each
// takes a quarter of the cores of the host, at least 1 and at most 4. On 4
// cores, as on GitHub's runners, a second worker for each browser shortens
// the run a little but brings the slowest tests close to their timeouts;
// above 4 workers, a run shortens little while the load of the backend
// grows. --workers overrides it.
const WORKERS = Math.min(
  4,
  Math.max(1, Math.floor(availableParallelism() / 4)),
);
// The modules of the projects that check how the UI is served: the same
// origin of the UI and the API, and the UI's image.
const SAME_ORIGIN = "**/same-origin.spec.ts";
const IMAGE = "**/image.spec.ts";
// The tag of the tests that change data that a screen shows
// (docs/conventions.md, End-to-End Tests).
const CHANGES_DATA = /@changes-data/;

// The two projects of a browser, which run every module but image.spec.ts
// against the end-to-end environment (docs/conventions.md, End-to-End
// Tests). The one named after the browser, which scripts/dev-env.sh e2e
// selects, holds the tests tagged CHANGES_DATA, and depends on
// <browser>-read-only, which holds the others, so Playwright runs that
// project first. Playwright never narrows a project that another depends on:
// a run that selects some tests, such as the tests of a module, runs it as a
// whole when the selection holds a tagged test, and otherwise runs the
// selected tests in it alone. Both keep their results in the output
// directory of the browser, which Playwright clears as the run starts.
function browserProjects(
  browser: "chromium" | "firefox",
  project: Pick<Project, "use" | "ignoreSnapshots">,
): Project[] {
  const shared = {
    ...project,
    testIgnore: IMAGE,
    outputDir: `test-results/e2e/${browser}/output`,
  };
  const readOnly = `${browser}-read-only`;
  return [
    { ...shared, name: readOnly, grepInvert: CHANGES_DATA },
    {
      ...shared,
      name: browser,
      grep: CHANGES_DATA,
      dependencies: [readOnly],
    },
  ];
}

export default defineConfig({
  testDir: "test/e2e",
  // A reference is named after the screen and state that it shows, never
  // after the test or its file (docs/conventions.md, End-to-End Tests).
  snapshotPathTemplate: "{testDir}/screenshots/{arg}{ext}",
  // A missing or different reference fails the test; scripts/dev-env.sh
  // update-screenshots writes them.
  updateSnapshots: "none",
  // Each run keeps its own results: Playwright clears the output directory
  // of the project that the run selects as the run starts, and
  // scripts/tooling.sh e2e names the report directory after that project.
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
  // scripts/dev-env.sh e2e selects the project named after each browser
  // (browserProjects).
  projects: [
    ...browserProjects("chromium", {
      use: { ...devices["Desktop Chrome"], viewport: VIEWPORT },
    }),
    // The references are Chromium's: Firefox renders text differently.
    ...browserProjects("firefox", {
      use: { ...devices["Desktop Firefox"], viewport: VIEWPORT },
      ignoreSnapshots: true,
    }),
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
