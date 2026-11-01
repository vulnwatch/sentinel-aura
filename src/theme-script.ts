// Applies the stored theme preference before the page renders, so that every
// screen shows in the chosen theme from its first paint (docs/behaviors.md,
// Preferences; src/theme.ts). The entry document loads it as a classic script
// right after its meta element of the color schemes, a file of the UI's
// origin under the Content Security Policy (vite.config.ts;
// docs/architecture.md, Security Headers). As a classic script, it imports
// and exports nothing, not even a type, which would make the development
// server serve it as a module, and it repeats the key and the values of the
// preference from src/theme.ts: keep both in sync. Its names stay inside a
// block, so that it declares no global name. It marks the theme on the root
// element, for the stylesheet, and sets that meta element to it, which the
// browser uses for the blank page until the stylesheet arrives.
try {
  const value = window.localStorage.getItem("sentinel-aura:theme");
  if (value === "light" || value === "dark") {
    document.documentElement.dataset.theme = value;
    const meta = document.querySelector<HTMLMetaElement>(
      'meta[name="color-scheme"]',
    );
    if (meta !== null) {
      meta.content = value;
    }
  }
} catch {
  // The browser blocks the storage: the page shows the System theme.
}
