import type { Page } from "@playwright/test";
import { expect, expectAccessible, test } from "./fixtures";

// A page whose text meets the contrast minimum of WCAG, 4.5:1, only in the
// light theme: `accent` on `surface`, a pair that the Contrast Table lists for
// no text, has 5.19 in the light theme and 3.73 in the dark one
// (docs/design-system.md, Color Tokens; Contrast Table).
const LIGHT_ONLY_CONTRAST = `<!doctype html>
<html lang="en">
  <head>
    <title>A fictional page</title>
    <style>
      p { color: #0969da; background-color: #ffffff; }
      @media (prefers-color-scheme: dark) {
        p { color: #1f6feb; background-color: #151b23; }
      }
    </style>
  </head>
  <body>
    <main><p>A fictional text</p></main>
  </body>
</html>`;

// Whether the page reports a preference for a dark color scheme.
async function prefersDark(page: Page): Promise<boolean> {
  return page.evaluate(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
}

test.describe("the end-to-end environment", () => {
  test("serves the UI's production image with its policy", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.headers()["content-security-policy"]).toContain(
      "require-trusted-types-for 'script'",
    );
  });
});

// Each of these tests breaks one check of the shared fixture, which must then
// fail it, or shows how the checks leave the page.
test.describe("the checks of every test", () => {
  test("fail on a policy violation", async ({ page }) => {
    test.fail();
    await page.goto("/");
    await page.evaluate(() => {
      const style = document.createElement("style");
      style.textContent = "body { color: black; }";
      document.head.append(style);
    });
  });

  test("fail on an uncaught exception", async ({ page }) => {
    test.fail();
    await page.goto("/");
    const error = page.waitForEvent("pageerror");
    await page.evaluate(() => {
      setTimeout(() => {
        throw new Error("A fictional uncaught exception");
      });
    });
    await error;
  });

  test("fail on an accessibility violation", async ({ page }) => {
    test.fail();
    await page.goto("/");
    await page.evaluate(() => {
      document.body.append(document.createElement("button"));
    });
  });

  // The light color scheme is checked first, so a failure under the dark one
  // shows that the light one passed. A page of content set by the test has no
  // address, so the check of its final state leaves it out.
  test("fail on an accessibility violation in the dark color scheme alone", async ({
    page,
  }) => {
    await page.setContent(LIGHT_ONLY_CONTRAST);
    await expect(expectAccessible(page)).rejects.toThrow(
      /^axe-core violations in the dark color scheme\n[\s\S]*color-contrast: /,
    );
  });

  test("return the page to its color scheme", async ({ page }) => {
    await page.goto("/");
    await expectAccessible(page);
    expect(await prefersDark(page), "the default light color scheme").toBe(
      false,
    );
    await page.emulateMedia({ colorScheme: "dark" });
    await expectAccessible(page);
    expect(await prefersDark(page), "the dark color scheme of the test").toBe(
      true,
    );
  });
});
