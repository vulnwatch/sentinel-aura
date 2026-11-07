import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import mainUrl from "./main?url";
import { SESSION_RECORD_KEY } from "./session";
import { FICTIONAL_USER, jsonResponse, stubApi } from "./test-api";
import { THEME_STORAGE_KEY } from "./theme";

// The entry document runs the entry point as a module (index.html), so the
// tests import it, each time under a URL of its own, so that it runs again.

const root = document.documentElement;
// The runs of the entry point, which name the URL of each.
let runs = 0;

// The application reads the signed-in user as it loads, and shows the screen
// of the URL of the page: a path that matches no screen, which shows Not
// found to a signed-in user without reading anything else. The page keeps
// that URL after the tests, because the application of each run stays
// mounted, follows the URL of the page, and would leave / for the Ticket
// list, which reads it; each test file runs in a page of its own.
beforeEach(() => {
  window.history.replaceState(window.history.state, "", "/fictional/path");
  stubApi(() => jsonResponse(200, FICTIONAL_USER));
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.removeItem(THEME_STORAGE_KEY);
  window.localStorage.removeItem(SESSION_RECORD_KEY);
  delete root.dataset.theme;
  document.getElementById("root")?.remove();
});

// Adds the element in which the entry document mounts the application.
function addRootElement(): HTMLElement {
  const container = document.createElement("div");
  container.id = "root";
  document.body.append(container);
  return container;
}

async function runEntryPoint(): Promise<void> {
  runs += 1;
  await import(/* @vite-ignore */ `${mainUrl}?run=${runs}`);
}

test("mounts the application in the #root element", async () => {
  const container = addRootElement();

  await runEntryPoint();

  await expect
    .element(
      page
        .elementLocator(container)
        .getByRole("heading", { level: 1, name: "Not found" }),
    )
    .toBeVisible();
});

test("shows the stored theme", async () => {
  window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
  addRootElement();

  await runEntryPoint();

  expect(root.dataset.theme).toBe("dark");
});

test("fails with an error that names the missing #root element", async () => {
  await expect(runEntryPoint()).rejects.toThrow("Missing the #root element");
});
