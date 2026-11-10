import type { Page } from "@playwright/test";
import {
  expect,
  expectAccessible,
  expectViewCounts,
  signIn,
  test,
  withFixedDates,
} from "./fixtures";

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
    // Without a session, the UI shows Sign in once it has read the session.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
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

// Whether a request reads the count of the All view of the Ticket list: List
// Tickets without a filter, with per_page=1 (docs/screens/ticket-list.md,
// Content).
function readsAllCount(url: URL): boolean {
  return url.pathname === "/api/v1/tickets" && url.search === "?per_page=1";
}

test.describe("the wait for the counts of the views", () => {
  // On a page without views, as before the list shows them, where no view
  // lacks its count yet.
  test("lasts until the views show", async ({ page }) => {
    await expect(expectViewCounts(page)).rejects.toThrow(/toBeVisible/);
  });

  test("lasts until each view shows its count", async ({ page }) => {
    // The count of the All view arrives only once the test lets it through.
    let release!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(readsAllCount, async (route) => {
      await released;
      await route.continue();
    });
    // asmith of the dataset lands on the Ticket list (signIn).
    await signIn(page, "asmith");
    const views = page.getByRole("tablist", { name: "Views" }).getByRole("tab");
    await expect(views.first()).toHaveText(/^New \d+$/);

    await expect(expectViewCounts(page)).rejects.toThrow(/toHaveCount/);

    release();
    await expectViewCounts(page);
    await expect(views.filter({ hasText: "All" })).toHaveText(/^All \d+$/);
  });
});

// Dates of each kind whose texts differ in width: a day of one digit and one
// of two, and the widest text of the kind, the longest day and month in Inter.
// Each is followed on its line by a word, which the dates must not move.
const DATES = [
  ["2026-11-09T14:05:00Z", "9 Nov 2026, 14:05"],
  ["2026-11-10T14:05:00Z", "10 Nov 2026, 14:05"],
  ["2026-05-28T23:59:00Z", "28 May 2026, 23:59"],
  ["2026-11-09", "9 Nov 2026"],
  ["2026-11-10", "10 Nov 2026"],
  ["2026-05-28", "28 May 2026"],
] as const;

// Where the word after each date starts, and whether each date fits in its
// box, as the page renders them.
async function datesLaidOut(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("[data-fictional-date]")].map((line) => {
      const date = line.querySelector("time");
      const word = line.querySelector("span");
      return {
        after: word?.getBoundingClientRect().left,
        fits: date !== null && date.scrollWidth <= date.clientWidth,
      };
    }),
  );
}

test.describe("the reference screenshots", () => {
  // On a page of the UI, under its policy, which a style element would
  // violate, with the font and the figures of the dates of the UI
  // (src/components/date-time.tsx).
  test("give the dates a fixed width for a screenshot alone", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.evaluate((dates) => {
      for (const [value, text] of dates) {
        const line = document.createElement("p");
        line.dataset.fictionalDate = "";
        const date = document.createElement("time");
        date.dateTime = value;
        date.className = "tabular-nums";
        date.textContent = text;
        const word = document.createElement("span");
        word.textContent = "Modified";
        line.append(date, " ", word);
        document.querySelector("main")?.append(line);
      }
      return document.fonts.ready.then(() => undefined);
    }, DATES);
    const own = await datesLaidOut(page);
    // As the UI renders them, the width of a date moves the word after it.
    expect(new Set(own.slice(0, 3).map(({ after }) => after)).size).toBe(3);
    expect(new Set(own.slice(3).map(({ after }) => after)).size).toBe(3);

    const fixed = await withFixedDates(page, () => datesLaidOut(page));

    // Each date of a kind then takes the same width, at least that of its
    // widest text.
    expect(new Set(fixed.slice(0, 3).map(({ after }) => after)).size).toBe(1);
    expect(new Set(fixed.slice(3).map(({ after }) => after)).size).toBe(1);
    expect(fixed.map(({ fits }) => fits)).toEqual(DATES.map(() => true));
    // And the page then renders as before.
    expect(await datesLaidOut(page)).toEqual(own);
  });
});
