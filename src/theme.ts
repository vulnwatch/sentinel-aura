import { storedPreference } from "./preferences";

// The theme that the page shows (docs/behaviors.md, Preferences;
// docs/design-system.md, Themes). The stylesheet shows the theme of the color
// scheme that the browser reports, the System theme, unless the root element
// marks the theme that the user chose, Light or Dark (src/styles.css).
// src/theme-script.ts applies the stored preference before the page renders;
// this module keeps it applied while the page runs.

// The key of the theme preference in the origin's local storage. A missing
// key is System. src/theme-script.ts repeats it: keep both in sync.
export const THEME_STORAGE_KEY = "sentinel-aura:theme";

export type ThemePreference = "system" | "light" | "dark";

// The preference that a stored value states. The value is untrusted, as every
// value of the origin's storage (docs/architecture.md, Same Origin): any value
// other than "light" or "dark" counts as the default, System.
export function parseThemePreference(value: string | null): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

// The theme preference, which the account menu sets (docs/screen-map.md,
// Sidebar).
export const themePreference = storedPreference(
  THEME_STORAGE_KEY,
  parseThemePreference,
);

// The stored preference, or System when the browser blocks the storage.
export function readThemePreference(): ThemePreference {
  return themePreference.get();
}

// Shows the theme of the preference on the page: marks it on the root element,
// for the stylesheet, and sets the meta element of the color schemes of the
// entry document to it, as src/theme-script.ts does.
export function applyThemePreference(
  preference: ThemePreference,
  root: HTMLElement = document.documentElement,
) {
  if (preference === "system") {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = preference;
  }
  const meta = root.ownerDocument.querySelector<HTMLMetaElement>(
    'meta[name="color-scheme"]',
  );
  if (meta !== null) {
    meta.content = preference === "system" ? "light dark" : preference;
  }
}

// Applies the stored preference now and again whenever it changes, in this
// tab or in another one of the browser, so that a change applies at once in
// every open tab. Returns the function that stops following it.
export function followThemePreference(): () => void {
  applyThemePreference(readThemePreference());
  return themePreference.subscribe(() => {
    applyThemePreference(readThemePreference());
  });
}
