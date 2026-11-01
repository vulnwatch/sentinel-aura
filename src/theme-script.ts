// Applies the stored theme preference before the page renders, so that every
// screen shows in the chosen theme from its first paint (docs/behaviors.md,
// Preferences; src/theme.ts). The entry document loads it as a classic script
// in its head, a file of the UI's origin under the Content Security Policy
// (vite.config.ts; docs/architecture.md, Security Headers). It therefore
// imports and exports nothing, not even a type, which would make the
// development server serve it as a module, and it repeats the key and the
// values of the preference from src/theme.ts: keep both in sync. Its names
// stay inside a block, so that it declares no global name.
try {
  const value = window.localStorage.getItem("sentinel-aura:theme");
  if (value === "light" || value === "dark") {
    document.documentElement.dataset.theme = value;
  }
} catch {
  // The browser blocks the storage: the page shows the System theme.
}
