// What the UI keeps of the session in the origin's browser storage
// (docs/behaviors.md, Session): the record that this browser has had a
// session, for the message of an expired session, and the URL of the screen
// to which Sign in returns. A script of the API's documentation page can
// change every value of that storage, so each is untrusted
// (docs/architecture.md, Same Origin). The browser can block the storage, in
// which case nothing is kept and nothing is found.

// The key of the session record in the origin's local storage, which the tabs
// of the browser share and which lasts across restarts, like the session
// cookie (docs/behaviors.md, Session Expiration Message). Any value counts as
// a record: a planted or removed one only shows or hides that message.
export const SESSION_RECORD_KEY = "sentinel-aura:session";

// The key of the URL to which Sign in returns, in the tab's session storage,
// where it survives a reload of Sign in (docs/behaviors.md, Return After
// Sign-in).
export const RETURN_URL_KEY = "sentinel-aura:return-url";

// The paths to which Sign in never returns, in lower case and without a
// trailing slash, as the router matches them: Sign in itself and
// /auth/callback (docs/screen-map.md, Contract URLs), and /api and the paths
// under /api/, which belong to the API (docs/architecture.md, Same Origin) and
// which the prefix of the API matches once a slash ends the path.
const NO_RETURN_PATHS = new Set(["/login", "/auth/callback"]);
const API_PREFIX = "/api/";

// Records that this browser has a session, after a successful read of the
// signed-in user. The record holds no data read from the API.
export function rememberSession() {
  try {
    window.localStorage.setItem(SESSION_RECORD_KEY, "signed-in");
  } catch {
    // The browser blocks the storage: Sign in then shows no expiration.
  }
}

// Forgets the session after the user signs out (docs/behaviors.md, Sign-out):
// removes the session record, for every tab of the browser, so that Sign in
// tells no tab that a session has expired, and the URL saved in this tab, so
// that Sign in opens the landing after the next sign-in.
export function forgetSession() {
  try {
    window.localStorage.removeItem(SESSION_RECORD_KEY);
  } catch {
    // The browser blocks the storage: it holds no record.
  }
  try {
    window.sessionStorage.removeItem(RETURN_URL_KEY);
  } catch {
    // The browser blocks the storage: it holds no saved URL.
  }
}

// Whether the browser has had a session, as the record states it.
export function hasSessionRecord(): boolean {
  try {
    return window.localStorage.getItem(SESSION_RECORD_KEY) !== null;
  } catch {
    return false;
  }
}

// Saves the URL of the screen from which the UI leads to Sign in: its path,
// search, and fragment.
export function saveReturnUrl(url: string) {
  try {
    window.sessionStorage.setItem(RETURN_URL_KEY, url);
  } catch {
    // The browser blocks the storage: Sign in then opens the landing.
  }
}

// Reads and removes the saved URL, and returns the path, search, and fragment
// that Sign in opens, or undefined when the value counts as absent
// (returnPath).
export function takeReturnUrl(): string | undefined {
  let value: string | null;
  try {
    value = window.sessionStorage.getItem(RETURN_URL_KEY);
    window.sessionStorage.removeItem(RETURN_URL_KEY);
  } catch {
    return undefined;
  }
  return returnPath(value, window.location.origin);
}

// The path, search, and fragment of a saved value when it is a path of the
// UI's origin other than /api, a path under /api/, Sign in, or
// /auth/callback; undefined for any other value, such as one that resolves to
// another origin, so that a planted value cannot lead the user out of the UI
// after a genuine sign-in (docs/behaviors.md, Return After Sign-in).
export function returnPath(
  value: string | null,
  origin: string,
): string | undefined {
  if (value === null) {
    return undefined;
  }
  let url: URL;
  try {
    url = new URL(value, origin);
  } catch {
    return undefined;
  }
  // A path that starts with two slashes would name another host if it were
  // resolved again, as a path of the router is.
  if (url.origin !== origin || url.pathname.startsWith("//")) {
    return undefined;
  }
  // The router matches a path decoded, in any case, and with a trailing
  // slash.
  let path: string;
  try {
    path = decodeURIComponent(url.pathname).toLowerCase();
  } catch {
    return undefined;
  }
  path = path.replace(/\/+$/, "");
  if (NO_RETURN_PATHS.has(path) || `${path}/`.startsWith(API_PREFIX)) {
    return undefined;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
