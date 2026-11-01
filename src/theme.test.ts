import { afterEach, expect, test, vi } from "vitest";
import {
  applyThemePreference,
  followThemePreference,
  parseThemePreference,
  readThemePreference,
  THEME_STORAGE_KEY,
} from "./theme";

const root = document.documentElement;

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.removeItem(THEME_STORAGE_KEY);
  delete root.dataset.theme;
});

// Makes the browser's local storage throw, as when the browser blocks it.
function blockStorage() {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new DOMException("The storage is blocked.", "SecurityError");
  });
}

test("a stored light or dark states its theme", () => {
  expect(parseThemePreference("light")).toBe("light");
  expect(parseThemePreference("dark")).toBe("dark");
});

test("a missing or any other stored value counts as System", () => {
  for (const value of [null, "", "system", "Dark", "blue", " light"]) {
    expect(parseThemePreference(value), String(value)).toBe("system");
  }
});

test("reads the preference from the origin's local storage", () => {
  expect(readThemePreference()).toBe("system");
  window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
  expect(readThemePreference()).toBe("dark");
  window.localStorage.setItem(THEME_STORAGE_KEY, "unknown");
  expect(readThemePreference()).toBe("system");
});

test("reads System when the browser blocks the storage", () => {
  blockStorage();
  expect(readThemePreference()).toBe("system");
});

test("marks the chosen theme on the root element, and System by no mark", () => {
  applyThemePreference("dark");
  expect(root.dataset.theme).toBe("dark");
  applyThemePreference("light");
  expect(root.dataset.theme).toBe("light");
  applyThemePreference("system");
  expect(root.dataset.theme).toBeUndefined();
});

test("applies the stored preference and follows its changes in other tabs", () => {
  window.localStorage.setItem(THEME_STORAGE_KEY, "light");
  const stop = followThemePreference();
  try {
    expect(root.dataset.theme).toBe("light");

    // Another tab stores Dark; the browser tells this tab with a storage
    // event, which a test dispatches itself.
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    window.dispatchEvent(
      new StorageEvent("storage", { key: THEME_STORAGE_KEY, newValue: "dark" }),
    );
    expect(root.dataset.theme).toBe("dark");

    // Another tab clears the storage: the key of the event is null.
    window.localStorage.removeItem(THEME_STORAGE_KEY);
    window.dispatchEvent(new StorageEvent("storage", { key: null }));
    expect(root.dataset.theme).toBeUndefined();
  } finally {
    stop();
  }
});

test("ignores the changes of other keys", () => {
  const stop = followThemePreference();
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    window.dispatchEvent(
      new StorageEvent("storage", { key: "another-key", newValue: "x" }),
    );
    expect(root.dataset.theme).toBeUndefined();
  } finally {
    stop();
  }
});

test("stops following the changes when told to", () => {
  const stop = followThemePreference();
  stop();
  window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
  window.dispatchEvent(
    new StorageEvent("storage", { key: THEME_STORAGE_KEY, newValue: "dark" }),
  );
  expect(root.dataset.theme).toBeUndefined();
});
