import { expect, expectScreenshot, signIn, test } from "./fixtures";

// Not found (docs/behaviors.md, Missing and Inaccessible Records): the UI's
// image serves the entry document for a path that matches no file of the
// build, and the application shows Not found for a path that matches no
// screen, which requires a session like every path but Sign in and
// /auth/callback (docs/screen-map.md, Contract URLs).
test("a path that matches no screen shows Not found", async ({ page }) => {
  await signIn(page);

  await page.goto("/fictional/path");

  await expect(
    page.getByRole("heading", { level: 1, name: "Not found" }),
  ).toBeVisible();
  await expect(
    page.getByText("This page doesn't exist, or you don't have access to it."),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Go to the start page" }),
  ).toBeVisible();
  await expect(page).toHaveTitle("Not found – Sentinel");
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
  await expectScreenshot(page, "not-found.png");
});

// /auth/callback requires no session, and no signed-in user is known there
// without one, so it shows in the column of the Sign In Page, without the
// sidebar (docs/screen-map.md, Sidebar; docs/design-system.md, Main Content).
test("/auth/callback without a session shows Not found in the column of the Sign In Page", async ({
  page,
}) => {
  await page.goto("/auth/callback");

  await expect(
    page.getByRole("heading", { level: 1, name: "Not found" }),
  ).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await expect(
    page.getByRole("main").getByText("Sentinel", { exact: true }),
  ).toBeVisible();
  await expectScreenshot(page, "not-found-signed-out.png");
});
