import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

// The favicon of every page: the Sentinel mark, in its light color, or in its
// dark one when the browser reports a preference for a dark color scheme
// (docs/design-system.md, Sentinel Mark). The tests draw it as the page loads
// it, from the UI's image and under its Content Security Policy.

// The colors of the mark's line, as red, green, blue, and alpha.
const LIGHT_COLOR = [0x21, 0x36, 0x61, 255];
const DARK_COLOR = [0xe6, 0xed, 0xf3, 255];

// Draws the favicon of the page at twice its size and returns the color of a
// pixel that its line covers whole: (4, 7) of its 24-unit grid, on the left
// side of the shield.
async function faviconColor(page: Page): Promise<number[]> {
  // The favicon has no role or name: the browser finds it by the relation of
  // its link, and so does the test.
  const source = await page.locator('link[rel="icon"]').getAttribute("href");
  expect(source, "a favicon of the asset directory").toMatch(
    /^\/assets\/[^/]+\.svg$/,
  );
  return page.evaluate(async (path) => {
    const image = new Image();
    image.src = path;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 48;
    canvas.height = 48;
    const context = canvas.getContext("2d");
    if (context === null) {
      throw new Error("the canvas has no 2D context");
    }
    context.drawImage(image, 0, 0, 48, 48);
    return Array.from(context.getImageData(8, 14, 1, 1).data);
  }, source ?? "");
}

test.describe("the favicon", () => {
  test.describe("under a light color scheme", () => {
    test.use({ colorScheme: "light" });

    test("draws its line in its light color", async ({ page }) => {
      await page.goto("/");
      expect(await faviconColor(page)).toEqual(LIGHT_COLOR);
    });
  });

  test.describe("under a dark color scheme", () => {
    test.use({ colorScheme: "dark" });

    test("draws its line in its dark color", async ({ page, browserName }) => {
      test.skip(
        browserName === "firefox",
        "Playwright emulates the color scheme for the documents of a page, which in Firefox excludes its images",
      );
      await page.goto("/");
      expect(await faviconColor(page)).toEqual(DARK_COLOR);
    });
  });
});
