import { afterEach, expect, test, vi } from "vitest";
import { renderHook } from "vitest-browser-react";
import {
  parseSidebarPreference,
  sidebarPreference,
  SIDEBAR_STORAGE_KEY,
  storedPreference,
  usePreference,
} from "./preferences";

const KEY = "sentinel-aura:fictional";

type Size = "small" | "large";

function parseSize(value: string | null): Size {
  return value === "large" ? value : "small";
}

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.removeItem(KEY);
  window.localStorage.removeItem(SIDEBAR_STORAGE_KEY);
});

// Makes the browser's local storage throw, as when the browser blocks it.
function blockStorage() {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new DOMException("The storage is blocked.", "SecurityError");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("The storage is blocked.", "SecurityError");
  });
}

// Another tab changes the storage; the browser tells this tab with a storage
// event, which a test dispatches itself.
function changeInAnotherTab(key: string | null, value: string | null) {
  if (key !== null && value !== null) {
    window.localStorage.setItem(key, value);
  }
  window.dispatchEvent(new StorageEvent("storage", { key, newValue: value }));
}

test("reads the stored value, and its default for a missing or any other one", () => {
  const size = storedPreference(KEY, parseSize);
  expect(size.get()).toBe("small");
  window.localStorage.setItem(KEY, "large");
  expect(size.get()).toBe("large");
  window.localStorage.setItem(KEY, "Large");
  expect(size.get()).toBe("small");
});

test("stores the value that is set and tells its listeners", () => {
  const size = storedPreference(KEY, parseSize);
  const listener = vi.fn();
  const stop = size.subscribe(listener);
  try {
    size.set("large");

    expect(window.localStorage.getItem(KEY)).toBe("large");
    expect(size.get()).toBe("large");
    expect(listener).toHaveBeenCalledTimes(1);
  } finally {
    stop();
  }
});

test("tells its listeners of a change in another tab, but not of another key", () => {
  const size = storedPreference(KEY, parseSize);
  const listener = vi.fn();
  const stop = size.subscribe(listener);
  try {
    changeInAnotherTab("another-key", "large");
    expect(listener).not.toHaveBeenCalled();

    changeInAnotherTab(KEY, "large");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(size.get()).toBe("large");

    // Another tab clears the storage: the key of the event is null.
    window.localStorage.removeItem(KEY);
    changeInAnotherTab(null, null);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(size.get()).toBe("small");
  } finally {
    stop();
  }
});

test("stops telling a listener once it unsubscribes", () => {
  const size = storedPreference(KEY, parseSize);
  const listener = vi.fn();
  size.subscribe(listener)();

  changeInAnotherTab(KEY, "large");
  size.set("small");

  expect(listener).not.toHaveBeenCalled();
});

test("reads its default when the browser blocks the storage, and keeps a value set in this tab", () => {
  const size = storedPreference(KEY, parseSize);
  blockStorage();
  expect(size.get()).toBe("small");

  size.set("large");

  expect(size.get()).toBe("large");
});

test("shows a component the value, and again after a change", async () => {
  const size = storedPreference(KEY, parseSize);
  const { result, act } = await renderHook(() => usePreference(size));
  expect(result.current).toBe("small");

  await act(() => {
    size.set("large");
  });
  expect(result.current).toBe("large");

  await act(() => {
    changeInAnotherTab(KEY, "small");
  });
  expect(result.current).toBe("small");
});

test("the sidebar is expanded unless collapsed is stored", () => {
  expect(parseSidebarPreference("collapsed")).toBe("collapsed");
  for (const value of [null, "", "expanded", "Collapsed", "hidden"]) {
    expect(parseSidebarPreference(value), String(value)).toBe("expanded");
  }
  expect(sidebarPreference.get()).toBe("expanded");
  sidebarPreference.set("collapsed");
  expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe("collapsed");
});
