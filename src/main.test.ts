import { afterEach, expect, test } from "vitest";
import { page } from "vitest/browser";
import mainUrl from "./main?url";
import { THEME_STORAGE_KEY } from "./theme";

// The entry document runs the entry point as a module (index.html), so the
// tests import it, each time under a URL of its own, so that it runs again.

const root = document.documentElement;
// The runs of the entry point, which name the URL of each.
let runs = 0;

afterEach(() => {
  window.localStorage.removeItem(THEME_STORAGE_KEY);
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
  // The page of the tests is at /, the path of the home page.
  expect(window.location.pathname).toBe("/");
  const container = addRootElement();

  await runEntryPoint();

  await expect
    .element(
      page
        .elementLocator(container)
        .getByRole("heading", { level: 1, name: "Sentinel Aura" }),
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
