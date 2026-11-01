import { afterEach, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import "./styles.css";
import { applyThemePreference } from "./theme";

// The tokens of docs/design-system.md, as Tailwind CSS generates their
// classes from src/styles.css, in each theme.

afterEach(() => {
  applyThemePreference("system");
});

// Each color token (Color Tokens; Tones; Severity Marks; Avatar, Palette), as
// the class that sets a background, with its value in the light and in the
// dark theme: a hexadecimal color, or a color as the browser computes it.
const COLOR_TOKENS: [className: string, light: string, dark: string][] = [
  ["bg-canvas", "#F6F8FA", "#0D1117"],
  ["bg-surface", "#FFFFFF", "#151B23"],
  ["bg-surface-2", "#F6F8FA", "#1A212A"],
  ["bg-surface-hover", "#F3F5F8", "#1E2630"],
  ["bg-sidebar", "#FFFFFF", "#010409"],
  ["bg-sidebar-active", "#EAEEF2", "#1E2630"],
  ["bg-fg", "#1F2328", "#E6EDF3"],
  ["bg-fg-muted", "#59636E", "#9198A1"],
  ["bg-border", "#D8DEE4", "#2F3742"],
  ["bg-border-strong", "#818B98", "#6E7681"],
  ["bg-accent", "#0969DA", "#1F6FEB"],
  ["bg-accent-hover", "#0757BA", "#1A5FCC"],
  ["bg-on-accent", "#FFFFFF", "#FFFFFF"],
  ["bg-link", "#0969DA", "#4493F8"],
  ["bg-focus", "#0969DA", "#4493F8"],
  ["bg-danger-solid", "#CF222E", "#DA3633"],
  ["bg-danger-solid-hover", "#A40E26", "#B62324"],
  ["bg-on-danger-solid", "#FFFFFF", "#FFFFFF"],
  ["bg-overlay", "rgba(15, 23, 42, 0.45)", "rgba(1, 4, 9, 0.7)"],
  ["bg-neutral-soft", "#EFF2F5", "#262C36"],
  ["bg-neutral-on-soft", "#3B434B", "#C9D1D9"],
  ["bg-neutral-icon", "#6E7781", "#9198A1"],
  ["bg-info-soft", "#DDF4FF", "#0D2A52"],
  ["bg-info-on-soft", "#0A3069", "#A5D6FF"],
  ["bg-info-icon", "#0969DA", "#4493F8"],
  ["bg-success-soft", "#DAFBE1", "#0E3320"],
  ["bg-success-on-soft", "#0F5323", "#7EE2A8"],
  ["bg-success-icon", "#1A7F37", "#3FB950"],
  ["bg-warning-soft", "#FFF8C5", "#3A2D00"],
  ["bg-warning-on-soft", "#6C4400", "#F2CC60"],
  ["bg-warning-icon", "#9A6700", "#D29922"],
  ["bg-danger-soft", "#FFEBE9", "#4A111A"],
  ["bg-danger-on-soft", "#A40E26", "#FFA198"],
  ["bg-danger-icon", "#CF222E", "#F85149"],
  ["bg-mark-critical", "#E5252A", "#E5252A"],
  ["bg-mark-high", "#F76B15", "#F76B15"],
  ["bg-mark-medium", "#F5C400", "#F5C400"],
  ["bg-mark-low", "#3B82F6", "#3B82F6"],
  ["bg-mark-none", "#8B949E", "#8B949E"],
  ["bg-avatar-bg", "#F0F0F0", "#F0F0F0"],
  ["bg-avatar-0", "#B91C1C", "#B91C1C"],
  ["bg-avatar-1", "#C2410C", "#C2410C"],
  ["bg-avatar-2", "#A16207", "#A16207"],
  ["bg-avatar-3", "#15803D", "#15803D"],
  ["bg-avatar-4", "#0F766E", "#0F766E"],
  ["bg-avatar-5", "#0369A1", "#0369A1"],
  ["bg-avatar-6", "#4338CA", "#4338CA"],
  ["bg-avatar-7", "#A21CAF", "#A21CAF"],
];

// Each type size (Type Scale): its size, line height, and letter spacing.
const TYPE_SIZES: [
  className: string,
  size: string,
  lineHeight: string,
  letterSpacing: string,
][] = [
  ["text-12", "12px", "16px", "normal"],
  ["text-13", "13px", "20px", "normal"],
  ["text-14", "14px", "20px", "normal"],
  ["text-15", "15px", "24px", "normal"],
  ["text-16", "16px", "24px", "normal"],
  ["text-20", "20px", "28px", "-0.5px"],
];

// A color as the browser computes it: rgb(r, g, b) for a hexadecimal color.
function computed(color: string): string {
  const hex = /^#([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/.exec(color);
  if (hex === null) {
    return color;
  }
  const [red, green, blue] = hex
    .slice(1)
    .map((part) => Number.parseInt(part, 16));
  return `rgb(${red}, ${green}, ${blue})`;
}

// The computed style of the element that shows the text.
async function styleOf(
  screen: Awaited<ReturnType<typeof render>>,
  text: string,
): Promise<CSSStyleDeclaration> {
  const locator = screen.getByText(text, { exact: true });
  await expect.element(locator).toBeInTheDocument();
  return getComputedStyle(locator.element());
}

for (const theme of ["light", "dark"] as const) {
  test(`gives every color token its value in the ${theme} theme`, async () => {
    applyThemePreference(theme);
    const screen = await render(
      <>
        {COLOR_TOKENS.map(([className]) => (
          <p key={className} className={className}>
            {className}
          </p>
        ))}
      </>,
    );
    for (const [className, light, dark] of COLOR_TOKENS) {
      const style = await styleOf(screen, className);
      expect(style.backgroundColor, className).toBe(
        computed(theme === "light" ? light : dark),
      );
    }
  });
}

test("gives every type size its size, line height, and letter spacing", async () => {
  const screen = await render(
    <>
      {TYPE_SIZES.map(([className]) => (
        <p key={className} className={className}>
          {className}
        </p>
      ))}
    </>,
  );
  for (const [className, size, lineHeight, letterSpacing] of TYPE_SIZES) {
    const style = await styleOf(screen, className);
    expect(style.fontSize, className).toBe(size);
    expect(style.lineHeight, className).toBe(lineHeight);
    expect(style.letterSpacing, className).toBe(letterSpacing);
  }
});

// The browser's text size, 16 px by default, enlarged to 20 px: every type
// size grows with it (docs/design-system.md, the sizes relative to the text
// size).
test("states every type size relative to the text size", async () => {
  const root = document.documentElement;
  root.style.fontSize = "20px";
  try {
    const screen = await render(
      <>
        {TYPE_SIZES.map(([className]) => (
          <p key={className} className={className}>
            {className}
          </p>
        ))}
      </>,
    );
    for (const [className, size, lineHeight] of TYPE_SIZES) {
      const style = await styleOf(screen, className);
      expect(style.fontSize, className).toBe(
        `${Number.parseFloat(size) * 1.25}px`,
      );
      expect(style.lineHeight, className).toBe(
        `${Number.parseFloat(lineHeight) * 1.25}px`,
      );
    }
  } finally {
    root.style.removeProperty("font-size");
  }
});

test("shows the page in canvas and fg, with text of 15 px in Inter", async () => {
  applyThemePreference("light");
  const body = getComputedStyle(document.body);
  expect(body.backgroundColor).toBe(computed("#F6F8FA"));
  expect(body.color).toBe(computed("#1F2328"));
  expect(body.fontSize).toBe("15px");
  expect(body.lineHeight).toBe("24px");
  expect(body.fontFamily).toBe("Inter, ui-sans-serif, system-ui, sans-serif");
});

test("sets monospace text in the system's monospace font", async () => {
  const screen = await render(<p className="font-mono">A monospace text</p>);
  const style = await styleOf(screen, "A monospace text");
  expect(style.fontFamily).toBe("ui-monospace, monospace");
});

test("has none of Tailwind's default colors, type sizes, and font families", async () => {
  const screen = await render(
    <p className="bg-white font-serif text-red-500 text-sm">A default text</p>,
  );
  const style = await styleOf(screen, "A default text");
  const body = getComputedStyle(document.body);
  expect(style.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect(style.color).toBe(body.color);
  expect(style.fontSize).toBe(body.fontSize);
  expect(style.fontFamily).toBe(body.fontFamily);
});
