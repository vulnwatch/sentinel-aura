import type { Locator, Page, Request } from "@playwright/test";
import {
  expect,
  expectAccessible,
  expectScreenshot,
  expectViewCounts,
  signIn,
  test,
} from "./fixtures";

// The sidebar and the account menu (docs/screen-map.md, Sidebar;
// docs/design-system.md, Sidebar; Account Menu), against a backend loaded
// with Sentinel's example dataset, whose users hold the roles of the dataset
// (Sentinel docs/features/platform/example-dataset.md, Users).

// The entries that every user sees, in their order, with their paths for a
// user without triage_ticket.
const ENTRIES = [
  ["Tickets", "/tickets"],
  ["My packages", "/my-packages"],
  ["Users", "/users"],
  ["Fetchers", "/fetchers"],
] as const;

function sidebar(page: Page) {
  return page.getByRole("navigation", { name: "Main" });
}

// A fictional profile picture on Slack's image host, the one host besides the
// UI's origin that the Content Security Policy allows (docs/architecture.md,
// Security Headers), which the test serves itself: no user of the dataset
// has a picture (Sentinel docs/features/platform/example-dataset.md, Users),
// and no test reaches Slack. An SVG document in one color.
const PICTURE_URL = "https://avatars.slack-edge.com/fictional/jdoe_192.jpg";
const PICTURE_COLOR = "#2f81f7";
const PICTURE = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192"><rect width="192" height="192" fill="${PICTURE_COLOR}"/></svg>`;

// The color of the pixel at the center of an element, as #rrggbb, from a
// screenshot of the element, which the page decodes.
async function centerColor(page: Page, element: Locator): Promise<string> {
  const png = (await element.screenshot()).toString("base64");
  return page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const bitmap = await createImageBitmap(
      new Blob([bytes], { type: "image/png" }),
    );
    // A new canvas has no other context, so the browser gives it a 2D one.
    const context = new OffscreenCanvas(bitmap.width, bitmap.height).getContext(
      "2d",
    )!;
    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(
      Math.floor(bitmap.width / 2),
      Math.floor(bitmap.height / 2),
      1,
      1,
    );
    return `#${Array.from(data.slice(0, 3), (value) =>
      value.toString(16).padStart(2, "0"),
    ).join("")}`;
  }, png);
}

// Waits until the Ticket list, the landing of jdoe, shows its rows and the
// counts of its views, which move what follows them, before a reference
// screenshot of it.
async function expectTicketListShown(page: Page) {
  await expect(
    page.getByRole("grid", { name: "Tickets" }).getByRole("rowheader"),
  ).toHaveCount(20);
  await expectViewCounts(page);
}

test.describe("the sidebar", () => {
  test("shows Administration to an administrator, after the entries of every user, and opens API keys from it", async ({
    page,
  }) => {
    // jdoe holds the admin role, with manage_users, without triage_ticket.
    await signIn(page, "jdoe");
    const links = sidebar(page).getByRole("list").getByRole("link");

    await expect(links).toHaveText([
      ...ENTRIES.map(([name]) => name),
      "Administration",
    ]);
    for (const [index, [, path]] of ENTRIES.entries()) {
      await expect(links.nth(index)).toHaveAttribute("href", path);
    }
    await expect(links.last()).toHaveAttribute("href", "/admin/api-keys");
    await expect(
      sidebar(page).getByRole("link", { name: "Tickets", exact: true }),
    ).toHaveAttribute("aria-current", "page");

    await links.last().click();

    await expect(page).toHaveURL("/admin/api-keys");
    await expect(
      page.getByRole("heading", { level: 1, name: "Not found" }),
    ).toBeFocused();
    await expect(links.last()).toHaveAttribute("aria-current", "page");
  });

  test("leads an analyst with Tickets to the New view of the Ticket list", async ({
    page,
  }) => {
    // asmith holds the vulnerability_analyst role.
    await signIn(page, "asmith");
    const tickets = sidebar(page).getByRole("link", {
      name: "Tickets",
      exact: true,
    });

    await expect(tickets).toHaveAttribute("href", "/tickets?view=new");
    await expect(tickets).toHaveAttribute("aria-current", "page");
  });

  test("shows no Administration to a user without a role", async ({ page }) => {
    await signIn(page, "dbrown");

    await expect(sidebar(page).getByRole("list").getByRole("link")).toHaveText(
      ENTRIES.map(([name]) => name),
    );
  });

  test("labels a bot account in the account button", async ({ page }) => {
    await signIn(page, "security-scanner");

    await expect(
      sidebar(page).getByRole("button", { name: "Security Scanner Bot" }),
    ).toBeVisible();
  });

  test("collapses to its icons", async ({ page }) => {
    await signIn(page);
    await expectTicketListShown(page);

    await sidebar(page)
      .getByRole("button", { name: "Collapse navigation" })
      .click();

    await expect(
      sidebar(page).getByRole("button", { name: "Expand navigation" }),
    ).toBeVisible();
    // To the empty part of the sidebar, away from the controls, whose
    // tooltips would show, and from the rows, which the pointer would mark.
    await page.mouse.move(28, 500);
    await expectScreenshot(page, "ticket-list-sidebar-collapsed.png");
  });

  test("stays collapsed after a reload", async ({ page }) => {
    await signIn(page);
    await sidebar(page)
      .getByRole("button", { name: "Collapse navigation" })
      .click();
    await expect(
      sidebar(page).getByRole("button", { name: "Expand navigation" }),
    ).toBeVisible();

    await page.reload();

    await expect(
      sidebar(page).getByRole("button", { name: "Expand navigation" }),
    ).toBeVisible();
    for (const [name, path] of ENTRIES) {
      await expect(
        sidebar(page).getByRole("link", { name, exact: true }),
      ).toHaveAttribute("href", path);
    }
  });

  test("opens over the content in a narrow window, as a dialog that Escape closes", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 800, height: 700 });
    await signIn(page);
    const expand = sidebar(page).getByRole("button", {
      name: "Expand navigation",
    });

    await expand.click();

    const dialog = page.getByRole("dialog", { name: "Navigation" });
    const close = dialog.getByRole("button", { name: "Close navigation" });
    await expect(close).toBeVisible();
    await expectAccessible(page);
    // The close button takes the place of the expand button, under the
    // pointer, so its tooltip shows, and Escape hides the tooltip first
    // (WCAG 2.2, 1.4.13 Content on Hover or Focus).
    await close.hover();
    await expect(
      page.getByRole("tooltip", { name: "Close navigation" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(expand).toBeFocused();
  });
});

test.describe("the account menu", () => {
  test("shows the signed-in user, Account, and API keys", async ({ page }) => {
    await signIn(page);
    await expectTicketListShown(page);

    await sidebar(page).getByRole("button", { name: "John Doe" }).click();

    const menu = page.getByRole("menu", { name: "John Doe" });
    await expect(
      page.getByRole("dialog", { name: "John Doe" }).getByText("@jdoe"),
    ).toBeVisible();
    await expect(menu.getByRole("menuitem")).toHaveText([
      "Account",
      "API keys",
      "Sign out",
    ]);
    await expect(
      menu.getByRole("menuitem", { name: "Account" }),
    ).toHaveAttribute("href", "/account");
    await expect(
      menu.getByRole("menuitem", { name: "API keys" }),
    ).toHaveAttribute("href", "/account/api-keys");
    await expectAccessible(page);
    await expectScreenshot(page, "ticket-list-account-menu.png");
  });

  test("shows the profile picture of the signed-in user, which the browser loads from Slack's image host without the address of the screen", async ({
    page,
  }) => {
    const pictures: Request[] = [];
    await page.route(PICTURE_URL, async (route) => {
      pictures.push(route.request());
      await route.fulfill({ contentType: "image/svg+xml", body: PICTURE });
    });
    // Get Current User gives jdoe the picture.
    await page.route(
      (url) => url.pathname === "/api/v1/users/me",
      async (route) => {
        const response = await route.fetch();
        if (!response.ok()) {
          await route.fulfill({ response });
          return;
        }
        const body: unknown = await response.json();
        if (
          typeof body !== "object" ||
          body === null ||
          !("data" in body) ||
          typeof body.data !== "object" ||
          body.data === null
        ) {
          throw new Error("Get Current User returned no user");
        }
        await route.fulfill({
          response,
          json: { ...body, data: { ...body.data, avatar_url: PICTURE_URL } },
        });
      },
    );
    await signIn(page);
    await sidebar(page)
      .getByRole("button", { name: "Collapse navigation" })
      .click();

    // In the collapsed sidebar, the account button is the avatar alone.
    const account = sidebar(page).getByRole("button", { name: "John Doe" });
    await expect.poll(() => centerColor(page, account)).toBe(PICTURE_COLOR);
    expect(pictures).not.toHaveLength(0);
    for (const request of pictures) {
      expect(await request.allHeaders()).not.toHaveProperty("referer");
    }
  });

  test("applies the theme that the user selects, which lasts across a reload", async ({
    page,
  }) => {
    await signIn(page);
    await sidebar(page).getByRole("button", { name: "John Doe" }).click();

    await page
      .getByRole("menu", { name: "John Doe" })
      .getByRole("menuitemradio", { name: "Dark" })
      .click();

    // canvas of the dark theme (docs/design-system.md, Color Tokens).
    const background = () =>
      page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await expect.poll(background).toBe("rgb(13, 17, 23)");
    await page.reload();
    await expect(
      page.getByRole("heading", { level: 1, name: "Tickets" }),
    ).toBeVisible();
    expect(await background()).toBe("rgb(13, 17, 23)");
    await sidebar(page).getByRole("button", { name: "John Doe" }).click();
    await expect(
      page
        .getByRole("menu", { name: "John Doe" })
        .getByRole("menuitemradio", { name: "Dark" }),
    ).toBeChecked();
  });
});
