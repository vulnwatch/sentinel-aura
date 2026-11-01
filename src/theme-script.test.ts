import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { THEME_STORAGE_KEY } from "./theme";
import themeScriptUrl from "./theme-script?url";

// The theme script runs as a classic script, as the entry document loads it
// (vite.config.ts), so the tests load it the same way.

const root = document.documentElement;
// The meta element of the color schemes, as the entry document declares it.
const meta = document.createElement("meta");
meta.name = "color-scheme";
// The script elements that the tests added.
const scripts: HTMLScriptElement[] = [];

beforeEach(() => {
  meta.content = "light dark";
  document.head.append(meta);
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.removeItem(THEME_STORAGE_KEY);
  delete root.dataset.theme;
  meta.remove();
  for (const script of scripts.splice(0)) {
    script.remove();
  }
});

// Runs the theme script as a classic script and returns the errors that it
// threw.
async function runThemeScript(): Promise<unknown[]> {
  const errors: unknown[] = [];
  const onError = (event: ErrorEvent) => {
    errors.push(event.error);
  };
  window.addEventListener("error", onError);
  try {
    const script = document.createElement("script");
    scripts.push(script);
    script.src = themeScriptUrl;
    const loaded = new Promise<void>((resolve, reject) => {
      script.addEventListener("load", () => {
        resolve();
      });
      script.addEventListener("error", () => {
        reject(new Error("the theme script did not load"));
      });
    });
    document.head.append(script);
    await loaded;
  } finally {
    window.removeEventListener("error", onError);
  }
  return errors;
}

test("marks a stored Light or Dark on the root element and the meta element", async () => {
  for (const theme of ["light", "dark"]) {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    expect(await runThemeScript()).toEqual([]);
    expect(root.dataset.theme).toBe(theme);
    expect(meta.content).toBe(theme);
  }
});

test("marks the root element without the meta element", async () => {
  meta.remove();
  window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
  expect(await runThemeScript()).toEqual([]);
  expect(root.dataset.theme).toBe("dark");
});

test("marks nothing for a missing or any other stored value", async () => {
  expect(await runThemeScript()).toEqual([]);
  expect(root.dataset.theme).toBeUndefined();
  for (const value of ["system", "Dark", "<b>dark</b>"]) {
    window.localStorage.setItem(THEME_STORAGE_KEY, value);
    expect(await runThemeScript()).toEqual([]);
    expect(root.dataset.theme, value).toBeUndefined();
    expect(meta.content, value).toBe("light dark");
  }
});

test("marks nothing, and throws nothing, when the browser blocks the storage", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new DOMException("The storage is blocked.", "SecurityError");
  });
  expect(await runThemeScript()).toEqual([]);
  expect(root.dataset.theme).toBeUndefined();
  expect(meta.content).toBe("light dark");
});
