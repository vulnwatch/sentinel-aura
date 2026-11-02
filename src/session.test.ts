import { afterEach, describe, expect, test, vi } from "vitest";
import {
  hasSessionRecord,
  rememberSession,
  RETURN_URL_KEY,
  returnPath,
  saveReturnUrl,
  SESSION_RECORD_KEY,
  takeReturnUrl,
} from "./session";

const ORIGIN = "https://sentinel.example.com";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.removeItem(SESSION_RECORD_KEY);
  window.sessionStorage.removeItem(RETURN_URL_KEY);
});

// Makes the browser's storage throw, as when the browser blocks it.
function blockStorage() {
  for (const method of ["getItem", "setItem", "removeItem"] as const) {
    vi.spyOn(Storage.prototype, method).mockImplementation(() => {
      throw new DOMException("The storage is blocked.", "SecurityError");
    });
  }
}

describe("the URL to which Sign in returns", () => {
  test.each([
    ["a path", "/tickets", "/tickets"],
    [
      "a path with its search and fragment",
      "/tickets?view=new&page=2#row-3",
      "/tickets?view=new&page=2#row-3",
    ],
    ["the landing", "/", "/"],
    ["a path that starts like /api", "/apidocs", "/apidocs"],
    ["a path that ends in /login", "/my-packages/login", "/my-packages/login"],
    [
      "a URL of the UI's origin, as its path",
      `${ORIGIN}/cves/CVE-2026-0001`,
      "/cves/CVE-2026-0001",
    ],
  ])("opens %s", (_, value, path) => {
    expect(returnPath(value, ORIGIN)).toBe(path);
  });

  test.each([
    ["no value", null],
    ["another origin", "https://attacker.example.com/tickets"],
    ["another scheme of the same host", "http://sentinel.example.com/tickets"],
    ["a path relative to the scheme", "//attacker.example.com/tickets"],
    [
      "a path relative to the scheme with a backslash",
      "/\\attacker.example.com",
    ],
    // A planted value that the check rejects, never a URL that the code
    // follows.
    // oxlint-disable-next-line no-script-url
    ["a script", "javascript:alert(1)"],
    ["data", "data:text/html,<p>fictional</p>"],
    ["a path of the origin that starts with two slashes", `${ORIGIN}//tickets`],
    ["/api", "/api"],
    ["a path under /api/", "/api/v1/users/me"],
    ["a path under /api/ in another case", "/API/v1/users/me"],
    ["a path under /api/ encoded", "/%61pi/v1/users/me"],
    ["Sign in", "/login"],
    ["Sign in with its search", "/login?next=/tickets"],
    ["Sign in in another case, with a trailing slash", "/Login/"],
    ["/auth/callback", "/auth/callback?code=fictional"],
    ["a path that cannot be decoded", "/tickets/%E0%A4%A"],
    ["a URL that cannot be parsed", "https://[fictional"],
  ])("counts %s as absent", (_, value) => {
    expect(returnPath(value, ORIGIN)).toBeUndefined();
  });

  test("is read and removed once", () => {
    saveReturnUrl("/tickets?view=new#top");

    expect(takeReturnUrl()).toBe("/tickets?view=new#top");
    expect(window.sessionStorage.getItem(RETURN_URL_KEY)).toBeNull();
    expect(takeReturnUrl()).toBeUndefined();
  });

  test("is removed when it counts as absent", () => {
    window.sessionStorage.setItem(
      RETURN_URL_KEY,
      "https://attacker.example.com",
    );

    expect(takeReturnUrl()).toBeUndefined();
    expect(window.sessionStorage.getItem(RETURN_URL_KEY)).toBeNull();
  });

  test("is kept in the tab's session storage", () => {
    saveReturnUrl("/cves");

    expect(window.sessionStorage.getItem(RETURN_URL_KEY)).toBe("/cves");
    expect(window.localStorage.getItem(RETURN_URL_KEY)).toBeNull();
  });

  test("is neither saved nor found while the browser blocks the storage", () => {
    blockStorage();

    expect(() => {
      saveReturnUrl("/cves");
    }).not.toThrow();
    expect(takeReturnUrl()).toBeUndefined();
  });
});

describe("the session record", () => {
  test("is kept in the origin's local storage once the browser has a session", () => {
    expect(hasSessionRecord()).toBe(false);

    rememberSession();

    expect(hasSessionRecord()).toBe(true);
    expect(window.localStorage.getItem(SESSION_RECORD_KEY)).not.toBeNull();
  });

  test("exists with any value, a planted one included", () => {
    window.localStorage.setItem(SESSION_RECORD_KEY, "");

    expect(hasSessionRecord()).toBe(true);
  });

  test("is neither kept nor found while the browser blocks the storage", () => {
    blockStorage();

    expect(() => {
      rememberSession();
    }).not.toThrow();
    expect(hasSessionRecord()).toBe(false);
  });
});
