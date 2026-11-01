import { expect, test } from "./fixtures";

// Not found (docs/behaviors.md, Missing and Inaccessible Records): the UI's
// image serves the entry document for a path that matches no file of the
// build, and the application shows Not found for a path that matches no
// screen.
test("a path that matches no screen shows Not found", async ({ page }) => {
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
  await expect(page).toHaveScreenshot("not-found.png");
});
