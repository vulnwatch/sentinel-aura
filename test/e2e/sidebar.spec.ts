import type { Page } from "@playwright/test";
import {
  avatars,
  dateTimes,
  expect,
  expectAccessible,
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

// Waits until the Ticket list, the landing of jdoe, shows its rows and the
// counts of its views, which move what follows them, before a reference
// screenshot of it.
async function expectTicketListShown(page: Page) {
  await expect(
    page.getByRole("grid", { name: "Tickets" }).getByRole("rowheader"),
  ).toHaveCount(20);
  await expectViewCounts(page);
}

// The reference screenshots mask the avatars and the dates, which change from
// one load of the dataset to the next (docs/conventions.md, End-to-End
// Tests).
function masked(page: Page) {
  return { mask: [avatars(page), dateTimes(page)] };
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
    await expect(page).toHaveScreenshot(
      "ticket-list-sidebar-collapsed.png",
      masked(page),
    );
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
    await expect(page).toHaveScreenshot(
      "ticket-list-account-menu.png",
      masked(page),
    );
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
