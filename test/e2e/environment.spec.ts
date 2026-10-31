import type { Page } from "@playwright/test";
import { expect, expectAccessible, test } from "./fixtures";

// A page with one text, in its colors under the light and under the dark color
// scheme.
function pageOfText(light: string, dark: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <title>A fictional page</title>
    <style>
      p { ${light} }
      @media (prefers-color-scheme: dark) {
        p { ${dark} }
      }
    </style>
  </head>
  <body>
    <main><p>A fictional text</p></main>
  </body>
</html>`;
}

// Texts whose contrast meets the minimum of WCAG, 4.5:1, in one theme only, in
// pairs that the Contrast Table lists for no text (docs/design-system.md,
// Themes and Colors; Contrast Table): `accent` on `surface`, 5.19 in the light
// theme and 3.73 in the dark one, and `neutral-icon` on `canvas`, 4.27 and
// 6.49.
const LIGHT_ONLY_CONTRAST = pageOfText(
  "color: #0969da; background-color: #ffffff;",
  "color: #1f6feb; background-color: #151b23;",
);
const DARK_ONLY_CONTRAST = pageOfText(
  "color: #6e7781; background-color: #f6f8fa;",
  "color: #9198a1; background-color: #0d1117;",
);

// The failures of the checks under each color scheme. The light one is
// checked first, so a failure under the dark one shows that the light one
// passed.
const LIGHT_FAILURE =
  /^axe-core violations in the light color scheme\n[\s\S]*color-contrast: /;
const DARK_FAILURE =
  /^axe-core violations in the dark color scheme\n[\s\S]*color-contrast: /;

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

  // Under the browser's default color scheme, and under a dark one that the
  // test chose, which the checks leave for the light one too. A page of
  // content set by the test has no address, so the check of its final state
  // leaves it out.
  test("fail on an accessibility violation in the dark color scheme alone", async ({
    page,
  }) => {
    await page.setContent(LIGHT_ONLY_CONTRAST);
    await expect(expectAccessible(page)).rejects.toThrow(DARK_FAILURE);
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(expectAccessible(page)).rejects.toThrow(DARK_FAILURE);
  });

  test("fail on an accessibility violation in the light color scheme", async ({
    page,
  }) => {
    await page.setContent(DARK_ONLY_CONTRAST);
    await expect(expectAccessible(page)).rejects.toThrow(LIGHT_FAILURE);
  });

  // The dark colors of LIGHT_ONLY_CONTRAST on the heading of a page of the UI,
  // in its final state, set through the CSS object model, which the policy
  // allows. The heading takes the size and weight of a level-one heading, 20
  // px and 600 (docs/design-system.md, Type Scale), which axe-core holds to
  // 4.5:1: it holds to 3:1, which the pair meets, only text of 24 px or more,
  // or of about 18.7 px or more at a weight of 700 or more.
  test("fail on an accessibility violation of the final state in the dark color scheme", async ({
    page,
  }) => {
    test.fail();
    await page.goto("/");
    await page.evaluate(() => {
      document.styleSheets[0]?.insertRule(
        "@media (prefers-color-scheme: dark) { h1 { font-size: 20px; font-weight: 600; color: #1f6feb; background-color: #151b23; } }",
      );
    });
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
