import type { Page } from "@playwright/test";
import { expect, expectAccessible, signIn, test } from "./fixtures";

// The sidebar and the account menu (docs/screen-map.md, Sidebar;
// docs/design-system.md, Sidebar; Account Menu), against a backend loaded
// with Sentinel's example dataset, whose users hold the roles of the dataset
// (Sentinel docs/features/platform/example-dataset.md, Users).

// The entries that every user sees, in their order, with their paths.
const ENTRIES = [
  ["Tickets", "/tickets"],
  ["CVEs", "/cves"],
  ["Packages", "/packages"],
  ["Products", "/products"],
  ["My packages", "/my-packages"],
  ["Data sources", "/data-sources"],
] as const;

function sidebar(page: Page) {
  return page.getByRole("navigation", { name: "Main" });
}

test.describe("the sidebar", () => {
  test("shows Administration to an administrator, after the entries of every user", async ({
    page,
  }) => {
    // jdoe holds the admin role, with manage_users.
    await signIn(page, "jdoe");
    const links = sidebar(page).getByRole("list").getByRole("link");

    await expect(links).toHaveText([
      ...ENTRIES.map(([name]) => name),
      "Administration",
    ]);
    await expect(links.last()).toHaveAttribute("href", "/admin/users");
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

  test("leads to the screen of an entry, marked as current, which shows Not found until its area is built", async ({
    page,
  }) => {
    await signIn(page);

    await sidebar(page).getByRole("link", { name: "Tickets" }).click();

    await expect(page).toHaveURL("/tickets");
    await expect(
      page.getByRole("heading", { level: 1, name: "Not found" }),
    ).toBeFocused();
    await expect(
      sidebar(page).getByRole("link", { name: "Tickets" }),
    ).toHaveAttribute("aria-current", "page");
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
    await expect(
      dialog.getByRole("button", { name: "Close navigation" }),
    ).toBeVisible();
    await expectAccessible(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(expand).toBeFocused();
  });
});

test.describe("the account menu", () => {
  test("shows the signed-in user and the screens of the account", async ({
    page,
  }) => {
    await signIn(page);

    await sidebar(page).getByRole("button", { name: "John Doe" }).click();

    const menu = page.getByRole("menu", { name: "John Doe" });
    await expect(page.getByText("John Doe @jdoe")).toBeVisible();
    await expect(menu.getByRole("menuitem")).toHaveText([
      "Profile",
      "API keys",
      "Identity audit log",
      "Sign out",
    ]);
    await expectAccessible(page);
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
      page.getByRole("heading", { level: 1, name: "Home" }),
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
