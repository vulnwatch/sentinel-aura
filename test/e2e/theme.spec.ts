import type { APIRequestContext, Page } from "@playwright/test";
import { expect, test } from "./fixtures";

// The themes (docs/behaviors.md, Preferences; docs/design-system.md, Themes):
// System follows the color scheme that the browser reports, and a stored
// Light or Dark keeps its theme from the first paint, in every open tab.

// The key of the theme preference in the origin's local storage, as
// src/theme.ts declares it.
const THEME_STORAGE_KEY = "sentinel-aura:theme";

type Theme = "light" | "dark";

declare global {
  interface Window {
    // The theme that the root element marked when the parser inserted the
    // body of the page, System for no mark.
    themeAtBody?: string;
  }
}

// The color of canvas, the background of the page, in each theme
// (docs/design-system.md, Color Tokens).
const CANVAS: Record<Theme, string> = {
  light: "rgb(246, 248, 250)",
  dark: "rgb(13, 17, 23)",
};

// The background of the page and the color scheme of its root element.
async function shownTheme(
  page: Page,
): Promise<{ background: string; colorScheme: string }> {
  return page.evaluate(() => ({
    background: getComputedStyle(document.body).backgroundColor,
    colorScheme: getComputedStyle(document.documentElement).colorScheme,
  }));
}

// Stores the value as the theme preference before each document of the page
// runs its own scripts.
async function storePreference(page: Page, value: string) {
  await page.addInitScript(
    ({ key, stored }) => {
      window.localStorage.setItem(key, stored);
    },
    { key: THEME_STORAGE_KEY, stored: value },
  );
}

// The color scheme that the page reports.
async function reportedScheme(page: Page): Promise<Theme> {
  return page.evaluate(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light",
  );
}

// Opens the entry document under the color scheme. Firefox does not apply the
// emulation of a color scheme to the first document that a page opens, from
// the browser context's option or from the page, so the page opens the
// document, emulates the scheme, and reloads it.
async function openUnder(page: Page, scheme: Theme) {
  await page.goto("/");
  await page.emulateMedia({ colorScheme: scheme });
  await page.reload();
  expect(await reportedScheme(page), "the emulated color scheme").toBe(scheme);
}

// Opens the home page under the color scheme and waits for the application to
// show it.
async function openHome(page: Page, scheme: Theme) {
  await openUnder(page, scheme);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

// The opposite of a theme.
function other(theme: Theme): Theme {
  return theme === "light" ? "dark" : "light";
}

// Makes the page fail to load the application's own script and, with
// `stylesheet`, the stylesheet, which the entry document references.
async function blockAssets(
  page: Page,
  request: APIRequestContext,
  { stylesheet }: { stylesheet: boolean },
) {
  const entry = await (await request.get("/")).text();
  const application = /<script type="module"[^>]* src="([^"]+)"/.exec(
    entry,
  )?.[1];
  expect(application, "the module script of the entry document").toMatch(
    /^\/assets\/[^/]+\.js$/,
  );
  const blocked = [application];
  if (stylesheet) {
    const sheet = /<link rel="stylesheet"[^>]* href="([^"]+)"/.exec(entry)?.[1];
    expect(sheet, "the stylesheet of the entry document").toMatch(
      /^\/assets\/[^/]+\.css$/,
    );
    blocked.push(sheet);
  }
  await page.route(
    (url) => blocked.includes(url.pathname),
    (route) => route.abort(),
  );
}

// The color scheme in which the browser draws the blank page while the page
// has no stylesheet: the one of its meta element of the color schemes, which
// selects the color of the system color Canvas, white in the light scheme.
async function blankPage(
  page: Page,
): Promise<{ meta: string | null; scheme: Theme }> {
  // The meta element is not shown to users, so the test finds it by its name.
  const meta = await page
    .locator('meta[name="color-scheme"]')
    .getAttribute("content");
  const canvas = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.backgroundColor = "Canvas";
    document.body.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  });
  return { meta, scheme: canvas === "rgb(255, 255, 255)" ? "light" : "dark" };
}

test.describe("the themes", () => {
  for (const scheme of ["light", "dark"] as const) {
    test.describe(`under a ${scheme} color scheme`, () => {
      test(`System shows the ${scheme} theme`, async ({ page }) => {
        await openHome(page, scheme);
        expect(await shownTheme(page)).toEqual({
          background: CANVAS[scheme],
          colorScheme: "light dark",
        });
      });

      for (const theme of ["light", "dark"] as const) {
        test(`a stored ${theme} theme shows`, async ({ page }) => {
          await storePreference(page, theme);
          await openHome(page, scheme);
          expect(await shownTheme(page)).toEqual({
            background: CANVAS[theme],
            colorScheme: theme,
          });
        });
      }

      test("any other stored value counts as System", async ({ page }) => {
        await storePreference(page, other(scheme).toUpperCase());
        await openHome(page, scheme);
        expect(await shownTheme(page)).toEqual({
          background: CANVAS[scheme],
          colorScheme: "light dark",
        });
      });

      // The theme script of the entry document applies the stored theme
      // before the page renders: the root element marks it when the parser
      // inserts the body, before which the browser renders nothing (HTML,
      // render-blocking), and with the application's own script blocked, the
      // page shows it all the same.
      test(`a stored ${other(scheme)} theme shows from the first paint, before the application runs`, async ({
        page,
        request,
      }) => {
        await blockAssets(page, request, { stylesheet: false });
        await storePreference(page, other(scheme));
        await page.addInitScript(() => {
          new MutationObserver((_records, observer) => {
            if (document.body !== null) {
              window.themeAtBody =
                document.documentElement.dataset.theme ?? "system";
              observer.disconnect();
            }
          }).observe(document, { childList: true, subtree: true });
        });
        await openUnder(page, scheme);
        await expect(page.getByRole("heading")).toHaveCount(0);
        expect(
          await page.evaluate(() => window.themeAtBody),
          "the theme that the root element marks when the body appears",
        ).toBe(other(scheme));
        expect(await shownTheme(page)).toEqual({
          background: CANVAS[other(scheme)],
          colorScheme: other(scheme),
        });
      });

      // Until the stylesheet arrives, the browser draws a blank page in the
      // color scheme that the meta element of the color schemes declares,
      // which the theme script sets to the stored theme.
      test("System draws the blank page in the color scheme before the stylesheet arrives", async ({
        page,
        request,
      }) => {
        await blockAssets(page, request, { stylesheet: true });
        await openUnder(page, scheme);
        expect(await blankPage(page)).toEqual({ meta: "light dark", scheme });
      });

      test(`a stored ${other(scheme)} theme draws the blank page before the stylesheet arrives`, async ({
        page,
        request,
      }) => {
        await blockAssets(page, request, { stylesheet: true });
        await storePreference(page, other(scheme));
        await openUnder(page, scheme);
        expect(await blankPage(page)).toEqual({
          meta: other(scheme),
          scheme: other(scheme),
        });
      });
    });
  }

  test.describe("while a page is open", () => {
    test("System follows the change without a reload", async ({ page }) => {
      await openHome(page, "light");
      expect((await shownTheme(page)).background).toBe(CANVAS.light);
      await page.emulateMedia({ colorScheme: "dark" });
      expect((await shownTheme(page)).background).toBe(CANVAS.dark);
    });

    test("a change of the stored theme applies at once in another tab", async ({
      page,
    }) => {
      const otherTab = await page.context().newPage();
      try {
        await openHome(otherTab, "light");
        await openHome(page, "light");

        await page.evaluate((key) => {
          window.localStorage.setItem(key, "dark");
        }, THEME_STORAGE_KEY);
        await expect
          .poll(() => shownTheme(otherTab))
          .toEqual({ background: CANVAS.dark, colorScheme: "dark" });

        await page.evaluate((key) => {
          window.localStorage.removeItem(key);
        }, THEME_STORAGE_KEY);
        await expect
          .poll(() => shownTheme(otherTab))
          .toEqual({ background: CANVAS.light, colorScheme: "light dark" });
      } finally {
        await otherTab.close();
      }
    });
  });
});
