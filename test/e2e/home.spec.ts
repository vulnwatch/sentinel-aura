import { avatars, expect, signIn, test } from "./fixtures";

// The Home, the landing (docs/screen-map.md, Landing), with the sidebar of
// every screen with a signed-in user (Sidebar), as jdoe of the dataset sees
// it. The Home requires a session (Contract URLs).
test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("the home page shows its heading beside the sidebar", async ({ page }) => {
  await expect(
    page.getByRole("heading", { level: 1, name: "Home" }),
  ).toBeVisible();
  await expect(page).toHaveTitle("Home – Sentinel");
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
  await expect(page).toHaveScreenshot("home.png", { mask: [avatars(page)] });
});

test("the home page with the collapsed sidebar", async ({ page }) => {
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("button", { name: "Collapse navigation" })
    .click();
  // Away from the controls, whose tooltips would show.
  await page.mouse.move(640, 400);

  await expect(
    page.getByRole("button", { name: "Expand navigation" }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot("home-sidebar-collapsed.png", {
    mask: [avatars(page)],
  });
});

test("the home page with the account menu open", async ({ page }) => {
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("button", { name: "John Doe" })
    .click();

  await expect(page.getByRole("menu", { name: "John Doe" })).toBeVisible();
  await expect(page).toHaveScreenshot("home-account-menu.png", {
    mask: [avatars(page)],
  });
});
